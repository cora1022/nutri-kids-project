from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Food
from app.routers.foods import NUTRIENT_UNITS, to_response
from app.schemas.common import NutrientQuality
from app.schemas.meal import (
    AnalysisWarning, MealAnalysisResponse, MealAnalyzeRequest, NutrientAssessment,
    NutrientStatus, QuantityUnit, Recommendation, ResolvedMealItem,
)

NUTRIENT_KEYS = tuple(NUTRIENT_UNITS)
TARGET_TABLE = {
    "MALE": [
        (6, 8, [1700, 35, 700, 9, 450, 50, 1600]),
        (9, 11, [1900, 40, 800, 10, 550, 55, 1900]),
        (12, 14, [2500, 55, 1000, 14, 750, 70, 2100]),
        (15, 18, [2700, 65, 900, 14, 850, 100, 2300]),
    ],
    "FEMALE": [
        (6, 8, [1500, 35, 700, 9, 400, 50, 1600]),
        (9, 11, [1700, 40, 800, 10, 450, 55, 1900]),
        (12, 14, [2000, 50, 900, 16, 650, 70, 1900]),
        (15, 18, [2000, 55, 800, 14, 650, 100, 1900]),
    ],
}


def meal_targets(request: MealAnalyzeRequest) -> dict[str, float]:
    rows = TARGET_TABLE[request.profile.sex.value]
    values = next(values for low, high, values in rows if low <= request.profile.age <= high)
    return {key: value / request.profile.meals_per_day for key, value in zip(NUTRIENT_KEYS, values)}


def factor(food: Food, quantity: float, unit: QuantityUnit) -> float | None:
    if unit == QuantityUnit.SERVING:
        return quantity
    if food.serving_amount is None:
        return None
    compatible = (unit == QuantityUnit.GRAM and food.serving_unit == "g") or (
        unit == QuantityUnit.MILLILITER and food.serving_unit == "ml"
    )
    return quantity / float(food.serving_amount) if compatible else None


def combined_quality(qualities: list[str], has_missing: bool) -> NutrientQuality:
    present = set(qualities)
    if not present:
        return NutrientQuality.MISSING
    if has_missing or len(present) > 1:
        return NutrientQuality.MIXED
    return NutrientQuality(next(iter(present)))


def analyze_meal(request: MealAnalyzeRequest, db: Session) -> MealAnalysisResponse:
    ids = [item.food_id for item in request.items]
    foods = db.scalars(
        select(Food).options(selectinload(Food.nutrients)).where(Food.id.in_(ids))
    ).all()
    by_id = {food.id: food for food in foods}
    missing_ids = [food_id for food_id in ids if food_id not in by_id]
    if missing_ids:
        raise ValueError(f"등록되지 않은 상품입니다: {', '.join(missing_ids)}")

    totals = {key: 0.0 for key in NUTRIENT_KEYS}
    qualities = {key: [] for key in NUTRIENT_KEYS}
    unknown = {key: False for key in NUTRIENT_KEYS}
    resolved_items, warnings = [], []
    total_price = 0
    price_unknown = False

    for item in request.items:
        food = by_id[item.food_id]
        multiplier = factor(food, item.quantity, item.quantity_unit)
        if multiplier is None:
            warnings.append(AnalysisWarning(code="UNIT_NOT_CONVERTIBLE", message="입력 단위를 제공량으로 환산할 수 없습니다.", food_id=food.id))
        nutrient_map = {nutrient.nutrient_key: nutrient for nutrient in food.nutrients}
        for key in NUTRIENT_KEYS:
            nutrient = nutrient_map.get(key)
            if multiplier is None or nutrient is None or nutrient.value is None:
                unknown[key] = True
                continue
            totals[key] += float(nutrient.value) * multiplier
            qualities[key].append(nutrient.quality)
        resolved_items.append(ResolvedMealItem(
            food_id=food.id, name=food.name, quantity=item.quantity,
            quantity_unit=item.quantity_unit,
            resolved_amount={"amount": float(food.serving_amount) * multiplier,
                             "unit": food.serving_unit, "count_unit": food.count_unit,
                             "label": food.serving_label} if multiplier is not None and food.serving_amount is not None else None,
            price=round(food.price * multiplier) if food.price is not None and multiplier is not None else None,
        ))
        if food.price is None or multiplier is None:
            price_unknown = True
        else:
            total_price += round(food.price * multiplier)

    targets = meal_targets(request)
    assessments = {}
    for key in NUTRIENT_KEYS:
        target = targets[key]
        actual = totals[key] if qualities[key] else None
        ratio = actual / target if actual is not None and target else None
        if unknown[key]:
            status = NutrientStatus.UNKNOWN
            warnings.append(AnalysisWarning(code="NUTRIENT_INCOMPLETE", message=f"{key} 값이 없는 상품이 있어 판정을 보류합니다."))
        elif key == "sodium":
            status = NutrientStatus.HIGH if ratio > 1 else NutrientStatus.ADEQUATE
        elif ratio < 0.85:
            status = NutrientStatus.LOW
        elif ratio > 1.3:
            status = NutrientStatus.HIGH
        else:
            status = NutrientStatus.ADEQUATE
        assessments[key] = NutrientAssessment(
            actual=round(actual, 2) if actual is not None else None,
            target=None if key == "sodium" else round(target, 2),
            upper_limit=round(target, 2) if key == "sodium" else None,
            unit=NUTRIENT_UNITS[key], ratio=round(ratio, 4) if ratio is not None else None,
            status=status, quality=combined_quality(qualities[key], unknown[key]),
        )

    deficient = [key for key, value in assessments.items() if value.status == NutrientStatus.LOW]
    recommendations = recommend(db, deficient, totals, targets, set(ids), request.recommendation_scope.value)
    return MealAnalysisResponse(
        analysis_id=f"analysis_{uuid4().hex}", meal_type=request.meal_type,
        items=resolved_items, total_price=None if price_unknown else total_price,
        nutrients=assessments, recommendations=recommendations, warnings=warnings,
    )


def recommend(db: Session, deficient: list[str], totals: dict[str, float], targets: dict[str, float],
              excluded: set[str], scope: str) -> list[Recommendation]:
    if not deficient:
        return []
    query = select(Food).options(selectinload(Food.nutrients))
    if scope == "CU_ONLY":
        query = query.where(Food.source_type == "CU_PRODUCT")
    foods = db.scalars(query).all()
    scored = []
    remaining_kcal = max(targets["kcal"] - totals["kcal"], 0)
    remaining_sodium = max(targets["sodium"] - totals["sodium"], 0)
    for food in foods:
        if food.id in excluded:
            continue
        values = {n.nutrient_key: float(n.value) if n.value is not None else None for n in food.nutrients}
        if values.get("kcal") is not None and remaining_kcal > 0 and values["kcal"] > remaining_kcal * 1.5:
            continue
        if values.get("sodium") is not None and values["sodium"] > remaining_sodium + 400:
            continue
        reasons, score = [], 0.0
        for key in deficient:
            value = values.get(key)
            if value and value > 0:
                reasons.append(key)
                score += min(value / max(targets[key] - totals[key], 1), 1)
        if score:
            scored.append((score, food, reasons))
    return [
        Recommendation(food=to_response(food), reason_nutrients=reasons,
                       message=f"{', '.join(reasons)} 보충에 도움이 되는 후보입니다.", score=round(score, 4))
        for score, food, reasons in sorted(scored, key=lambda item: item[0], reverse=True)[:3]
    ]
