"""식사 확정 시점의 상품 정보와 분석 결과를 회원별로 보관한다."""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Food, Meal, MealItem, User
from app.schemas.meal import (
    AnalysisProfile, AnalysisWarning, DailyAnalysis, DailyMealResponse, MealAnalysisResponse,
    MealCreateRequest, MealResponse, MealSummary, NutrientAssessment,
)
from app.services.nutrition.engine import (
    NUTRIENT_UNITS, REFERENCE_VERSION, Value, aggregate, analyze_meal, assess,
    build_targets, read_values, rounded, serving_factor,
)
from app.services.accounts import utc_now

KST = ZoneInfo("Asia/Seoul")


def saved_profile(user: User) -> AnalysisProfile:
    if user.profile is None:
        raise HTTPException(409, "먼저 회원 프로필을 저장해 주세요.")
    return AnalysisProfile.model_validate(user.profile)


def utc_naive(value: datetime) -> datetime:
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def utc_aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def as_response(meal: Meal) -> MealResponse:
    analysis = MealAnalysisResponse.model_validate(meal.analysis_snapshot)
    return MealResponse(id=meal.id, client_request_id=meal.client_request_id,
        meal_type=meal.meal_type, eaten_at=utc_aware(meal.eaten_at),
        saved_at=utc_aware(meal.created_at), items=analysis.items, analysis=analysis)


def request_fingerprint(request: MealCreateRequest) -> dict:
    data = request.model_dump(mode="json", by_alias=True, exclude={"profile", "client_request_id"})
    data["eatenAt"] = utc_naive(request.eaten_at).isoformat()
    return data


def existing_response(meal: Meal, request: MealCreateRequest) -> MealResponse:
    if meal.analysis_snapshot.get("_request") != request_fingerprint(request):
        raise HTTPException(409, "같은 저장 번호에 다른 내용이 있습니다. 새 식사로 저장해 주세요.")
    return as_response(meal)


def save_meal(db: Session, user: User, request: MealCreateRequest) -> tuple[MealResponse, bool]:
    query = select(Meal).where(Meal.user_id == user.id,
                                Meal.client_request_id == request.client_request_id)
    existing = db.scalar(query)
    if existing:
        return existing_response(existing, request), False
    # 클라이언트가 임의로 넘긴 프로필 대신 DB에 저장된 회원 프로필을 사용한다.
    request = request.model_copy(update={"profile": saved_profile(user)})
    try:
        analysis = analyze_meal(request, db)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    snapshot = analysis.model_dump(mode="json", by_alias=True)
    snapshot["_request"] = request_fingerprint(request)
    snapshot["_profile"] = request.profile.model_dump(mode="json", by_alias=True)
    meal = Meal(user_id=user.id, client_request_id=request.client_request_id,
        meal_type=request.meal_type, eaten_at=utc_naive(request.eaten_at),
        total_price=analysis.total_price, analysis_snapshot=snapshot, created_at=utc_now())
    for item, resolved in zip(request.items, analysis.items):
        food = db.get(Food, item.food_id)
        factor, _, _ = serving_factor(food, item)
        values = read_values(food, factor)
        meal.items.append(MealItem(food_id=item.food_id, food_name=resolved.name,
            quantity=item.quantity, quantity_unit=item.quantity_unit,
            resolved_amount=resolved.resolved_amount.model_dump(mode="json", by_alias=True)
                            if resolved.resolved_amount else None,
            nutrient_snapshot={key: {"amount": value.amount, "quality": value.quality}
                               for key, value in values.items()}))
    db.add(meal)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(query)
        if existing:
            return existing_response(existing, request), False
        raise
    return as_response(meal), True


def daily_meals(db: Session, user: User, target_date: date) -> DailyMealResponse:
    profile = saved_profile(user)
    start = datetime.combine(target_date, time.min, tzinfo=KST)
    stop = start + timedelta(days=1)
    meals = db.scalars(select(Meal).where(Meal.user_id == user.id,
        Meal.eaten_at >= utc_naive(start), Meal.eaten_at < utc_naive(stop))
        .order_by(Meal.eaten_at, Meal.id)).all()
    # n=1로 동일한 nutrition 계산기의 하루 목표와 판정 규칙을 재사용한다.
    targets, trace = build_targets(profile.model_copy(update={"meals_per_day": 1}))
    nutrients = {}
    for key, unit in NUTRIENT_UNITS.items():
        values = []
        for meal in meals:
            entry = meal.analysis_snapshot.get("nutrients", {}).get(key, {})
            values.append(Value(entry.get("actual"), entry.get("quality", "MISSING")))
        value, target = aggregate(values), targets.get(key)
        ratio, status = assess(value, target)
        if key == "carbohydrate" and targets[key].daily < trace["carbohydrate_rni_g"]:
            status = "UNKNOWN"
        nutrients[key] = NutrientAssessment(actual=rounded(value.amount),
            target=rounded(target.daily) if target else None,
            upper_limit=target.daily_ul if target else None, unit=unit,
            ratio=rounded(ratio, 4), status=status, quality=value.quality)
    warnings = [AnalysisWarning(code="REFERENCE_VERSION", message=REFERENCE_VERSION),
        AnalysisWarning(code="RECORDED_MEALS_ONLY",
            message="한국 시간의 해당 날짜에 저장한 식사만 합산하며 현재 회원 프로필의 하루 목표와 비교합니다.")]
    if any(value.actual is None for value in nutrients.values()):
        warnings.append(AnalysisWarning(code="NUTRIENT_DATA_MISSING",
            message="누락된 성분이 있는 영양소는 합계와 판정을 미확인으로 표시합니다."))
    for meal in meals:
        for entry in meal.analysis_snapshot.get("warnings", []):
            warning = AnalysisWarning.model_validate(entry)
            if warning.code in {"MEAL_PLANNING_POLICY", "ENERGY_CALCULATION", "DAILY_UL_NOT_MEAL_LIMIT"}:
                continue
            if not any(w.code == warning.code for w in warnings):
                warnings.append(warning)
    summaries = []
    for meal in meals:
        result = as_response(meal)
        summaries.append(MealSummary(id=meal.id, meal_type=meal.meal_type,
            eaten_at=result.eaten_at, item_names=[item.name for item in result.items],
            total_price=meal.total_price, client_request_id=meal.client_request_id,
            items=result.items, analysis=result.analysis))
    main_meal_count = sum(meal.meal_type != "SNACK" for meal in meals)
    return DailyMealResponse(date=target_date, recorded_meal_count=len(meals),
        expected_meal_count=profile.meals_per_day, is_partial=main_meal_count < profile.meals_per_day,
        meals=summaries, daily_analysis=DailyAnalysis(nutrients=nutrients, warnings=warnings))
