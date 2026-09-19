"""기존 JSON 계약을 유지하는 영양 분석 엔진.

2025 KDRI 기준표, 사용자 지정 EER 공식, 섭취량 환산, 평가와 추천을 이 파일에 모았다.
공인 기준과 서비스 정책의 구분, 출처와 계산 예시는 Algorithm.md를 참고한다.
공개 API 연결 함수는 analyze_meal(request, db)이다.
"""
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from math import isfinite
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Food, ProductStandardMapping
from app.schemas.common import NutrientValue
from app.schemas.food import FoodResponse, Serving, StandardFoodMatch
from app.schemas.meal import (
    AnalysisWarning,
    MealAnalysisResponse,
    MealAnalyzeRequest,
    NutrientAssessment,
    Recommendation,
    ResolvedMealItem,
)


# 1. 연령과 성별 기준표와 EER 계산

REFERENCE_VERSION = "KDRI-2025 / EER-KDRI-2020-as-used-in-Gwak-2023 / policy-v1"
NUTRIENT_UNITS = {
    "kcal": "kcal", "protein": "g", "calcium": "mg", "iron": "mg",
    "vitaminA": "µgRAE", "vitaminC": "mg", "sodium": "mg",
    "carbohydrate": "g", "vitaminD": "µg",
}
AGE_BANDS = ((6, 8), (9, 11), (12, 14), (15, 18))

# Each tuple follows AGE_BANDS. Values are daily, never per-meal ULs.
# Protein: PDF p13; calcium: p19; vitamin A/D: p15; vitamin C: p16.
RNI = {
    "MALE": {
        "protein": (35, 50, 60, 65), "calcium": (700, 800, 950, 800),
        "vitaminA": (450, 600, 750, 850), "vitaminC": (50, 70, 90, 100),
    },
    "FEMALE": {
        "protein": (35, 45, 55, 55), "calcium": (700, 800, 850, 700),
        "vitaminA": (400, 550, 650, 650), "vitaminC": (50, 70, 90, 100),
    },
}
EAR = {
    "MALE": {"protein": (30, 40, 50, 55), "calcium": (600, 700, 800, 700),
             "vitaminA": (310, 410, 540, 620), "vitaminC": (40, 55, 70, 80)},
    "FEMALE": {"protein": (30, 40, 45, 45), "calcium": (600, 700, 700, 550),
               "vitaminA": (290, 390, 480, 450), "vitaminC": (40, 55, 70, 80)},
}
VITAMIN_D_AI = (5, 5, 10, 10)
VITAMIN_D_UL = (40, 60, 100, 100)
VITAMIN_C_UL = (750, 1100, 1400, 1600)
VITAMIN_A_RETINOL_UL = (1100, 1600, 2300, 2800)
CALCIUM_UL = {"MALE": (3000,) * 4, "FEMALE": (2500,) * 4}
CARBOHYDRATE_RNI = 130  # g/day, PDF p12; separate from energy-based planning.
CARBOHYDRATE_AMDR = (0.50, 0.65)  # PDF p11, changed from 2020's 55-65%.
PROTEIN_AMDR = (0.10, 0.20)  # PDF p11; not a toxicity threshold.

# Gwak et al. (2023), Table 5, PDF p10 / printed p44.
PA_COEFFICIENTS = {
    "MALE": {"SEDENTARY": 1.0, "LOW_ACTIVE": 1.13, "ACTIVE": 1.26, "VERY_ACTIVE": 1.42},
    "FEMALE": {"SEDENTARY": 1.0, "LOW_ACTIVE": 1.16, "ACTIVE": 1.31, "VERY_ACTIVE": 1.56},
}
DEFAULT_ACTIVITY = "LOW_ACTIVE"  # A disclosed assumption, not measured activity.
ENERGY_BAND = (0.80, 1.20)  # Product feedback policy, NOT a KDRI clinical cutoff.


@dataclass(frozen=True)
class Target:
    daily: float
    per_meal: float
    kind: str
    daily_ul: float | None = None
    planning_range: tuple[float, float] | None = None


def age_band(age: int) -> int:
    if isinstance(age, bool) or not isinstance(age, int) or not 6 <= age <= 18:
        raise ValueError("지원 연령은 만 6-18세입니다.")
    return next(i for i, (lo, hi) in enumerate(AGE_BANDS) if lo <= age <= hi)


def calculate_eer(sex: str, age: int, height_cm: float, weight_kg: float,
                  activity: str = DEFAULT_ACTIVITY) -> dict:
    """Return an internal trace; no new REST response fields are introduced."""
    age_band(age)
    if sex not in PA_COEFFICIENTS or activity not in PA_COEFFICIENTS[sex]:
        raise ValueError("지원하지 않는 성별 또는 활동단계입니다.")
    if any(isinstance(v, bool) or not isfinite(v) or v <= 0 for v in (height_cm, weight_kg)):
        raise ValueError("키와 몸무게는 양의 유한수여야 합니다.")
    h = height_cm / 100
    g = 20 if age <= 8 else 25
    pa = PA_COEFFICIENTS[sex][activity]
    intercept, age_c, weight_c, height_c = (
        (88.5, 61.9, 26.7, 903) if sex == "MALE" else (135.3, 30.8, 10.0, 934)
    )
    result = intercept - age_c * age + pa * (weight_c * weight_kg + height_c * h) + g
    if not isfinite(result) or result <= 0:
        raise ValueError("입력값으로 양의 에너지필요추정량을 계산할 수 없습니다.")
    return {
        "version": REFERENCE_VERSION, "activity": activity, "pa": pa,
        "age_years": age, "weight_kg": weight_kg, "height_m": h, "growth_kcal": g,
        "formula": f"{intercept} - {age_c}*{age} + {pa}*({weight_c}*{weight_kg} + {height_c}*{h}) + {g}",
        "daily_kcal": result, "source": "Gwak et al. 2023, pp39/44, Table 5",
    }


def build_targets(profile) -> tuple[dict[str, Target], dict]:
    idx = age_band(profile.age)
    sex = str(profile.sex)
    n = profile.meals_per_day
    if isinstance(n, bool) or not isinstance(n, int) or not 1 <= n <= 6:
        raise ValueError("하루 식사 횟수는 1-6회여야 합니다.")
    trace = calculate_eer(sex, profile.age, profile.height_cm, profile.weight_kg)
    eer = trace["daily_kcal"]
    targets = {"kcal": Target(eer, eer / n, "EER")}
    for key, values in RNI[sex].items():
        ul = CALCIUM_UL[sex][idx] if key == "calcium" else VITAMIN_C_UL[idx] if key == "vitaminC" else None
        targets[key] = Target(values[idx], values[idx] / n, "RNI", ul)
    targets["vitaminD"] = Target(VITAMIN_D_AI[idx], VITAMIN_D_AI[idx] / n, "AI", VITAMIN_D_UL[idx])
    lo, hi = (eer * x / 4 for x in CARBOHYDRATE_AMDR)
    targets["carbohydrate"] = Target((lo + hi) / 2, (lo + hi) / 2 / n, "AMDR_PLAN",
                                     planning_range=(lo / n, hi / n))
    trace.update({"age_band": AGE_BANDS[idx], "meals_per_day": n,
                  "carbohydrate_daily_range_g": (lo, hi),
                  "carbohydrate_rni_g": CARBOHYDRATE_RNI,
                  "protein_energy_range_g": tuple(eer * x / 4 for x in PROTEIN_AMDR),
                  "ear": {key: values[idx] for key, values in EAR[sex].items()},
                  "vitamin_a_retinol_ul_ug": VITAMIN_A_RETINOL_UL[idx]})
    return targets, trace


# 2. 섭취량 환산과 합산, 상태 판정

@dataclass(frozen=True)
class Value:
    amount: float | None
    quality: str
    problem: str | None = None


def number(value) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        value = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return value if isfinite(value) and value >= 0 else None


def rounded(value: float | None, digits: int = 2) -> float | None:
    if value is None:
        return None
    return float(Decimal(str(value)).quantize(Decimal(1).scaleb(-digits), rounding=ROUND_HALF_UP))


def serving_factor(food, item) -> tuple[float | None, float | None, str | None]:
    """DB values are per stored serving, already converted by import_data.
    Do not convert g to ml: the schema contains no density.
    SERVING can use per-serving values without a known mass.
    """
    basis = number(food.serving_amount)
    unit = (food.serving_unit or "").strip().lower()
    if item.quantity_unit == "SERVING":
        amount = basis * item.quantity if basis and unit in {"g", "ml"} else None
        return item.quantity, amount, unit if amount is not None else None
    expected = {"GRAM": "g", "MILLILITER": "ml"}.get(str(item.quantity_unit))
    if basis is None or basis <= 0 or expected != unit:
        return None, item.quantity, expected
    return item.quantity / basis, item.quantity, expected


def normalized_value(row, key: str) -> Value:
    if row is None:
        return Value(None, "MISSING", "성분값 없음")
    value = number(row.value)
    if value is None or row.quality not in {"CONFIRMED", "ESTIMATED", "MIXED"}:
        return Value(None, "MISSING", "성분값 또는 품질 미확인")
    unit = (row.unit or "").replace("μ", "u").replace("µ", "u").replace(" ", "").lower()
    target = NUTRIENT_UNITS[key].replace("µ", "u").lower()
    masses = {"g": 0, "mg": -3, "ug": -6}
    if unit == target:
        return Value(value, row.quality)
    if target in masses and unit in masses:
        converted = Decimal(str(value)) * Decimal(10) ** (masses[unit] - masses[target])
        return Value(float(converted), row.quality)
    # IU and plain ug vitamin A lack RAE evidence: never guess.
    return Value(None, "MISSING", f"단위 불일치 ({row.unit} -> {NUTRIENT_UNITS[key]})")


def read_values(food, factor: float | None) -> dict[str, Value]:
    rows = {row.nutrient_key: row for row in food.nutrients}
    result = {}
    for key in NUTRIENT_UNITS:
        value = normalized_value(rows.get(key), key)
        if factor is None:
            result[key] = Value(None, "MISSING", "섭취 단위 환산 불가")
        elif value.amount is None:
            result[key] = value
        else:
            amount = value.amount * factor
            result[key] = (Value(amount, value.quality) if isfinite(amount)
                           else Value(None, "MISSING", "환산값 범위 초과"))
    return result


def aggregate(values: list[Value]) -> Value:
    if not values or any(v.amount is None for v in values):
        return Value(None, "MISSING", "일부 또는 전체 상품의 성분 미확인")
    qualities = {v.quality for v in values}
    quality = next(iter(qualities)) if len(qualities) == 1 else "MIXED"
    total = sum(v.amount for v in values)
    if not isfinite(total):
        return Value(None, "MISSING", "합계 범위 초과")
    return Value(total, quality)


def assess(value: Value, target: Target | None) -> tuple[float | None, str]:
    if value.amount is None or target is None:
        return None, "UNKNOWN"
    actual = value.amount
    ratio = actual / target.per_meal
    if target.daily_ul is not None and actual > target.daily_ul:
        return ratio, "HIGH"
    if target.kind == "AI":
        return ratio, "ADEQUATE" if actual >= target.per_meal else "UNKNOWN"
    if target.kind == "EER":
        lo, hi = (target.per_meal * r for r in ENERGY_BAND)
    elif target.planning_range is not None:
        lo, hi = target.planning_range
    else:
        # RNI is not an upper limit.
        return ratio, "LOW" if actual < target.per_meal else "ADEQUATE"
    return ratio, "LOW" if actual < lo else "HIGH" if actual > hi else "ADEQUATE"


# 3. 보완 식품 추천

def food_response(food, values) -> FoodResponse:
    rows = {r.nutrient_key: r for r in food.nutrients}
    nutrients = {}
    for key, value in values.items():
        source = rows[key].source if key in rows else "NONE"
        if value.amount is None or source not in {"MFDS", "NATIONAL_STANDARD", "MANUFACTURER"}:
            source = "NONE"
        nutrients[key] = NutrientValue(value=rounded(value.amount), unit=NUTRIENT_UNITS[key],
                                       quality=value.quality, source=source)
    qualities = {v.quality for v in values.values()}
    overall = next(iter(qualities)) if len(qualities) == 1 else "MIXED"
    mapping = sorted(food.standard_mappings, key=lambda m: m.standard_food_code)
    match = None
    if mapping and mapping[0].standard_food is not None:
        m = mapping[0]
        match = StandardFoodMatch(food_code=m.standard_food_code, name=m.standard_food.name,
                                  match_method=m.match_method, confidence=float(m.confidence))
    return FoodResponse(
        id=food.id, source_type=food.source_type, name=food.name, brand=food.brand,
        category=food.category, price=food.price, barcode=food.barcode,
        image_url=food.image_url, item_report_no=food.item_report_no,
        item_report_candidates=food.item_report_candidates or [],
        item_report_status=food.item_report_status, item_report_evidence=food.item_report_evidence,
        serving=Serving(amount=number(food.serving_amount), unit=food.serving_unit,
                        count_unit=food.count_unit, label=food.serving_label),
        nutrients=nutrients, overall_quality=overall, standard_food_match=match,
    )


def recommend(db, request, totals, targets) -> list[Recommendation]:
    deficits = {key: target.per_meal - totals[key].amount for key, target in targets.items()
                if assess(totals[key], target)[1] == "LOW"}
    if not deficits or totals["kcal"].amount is None:
        return []
    calorie_cap = targets["kcal"].per_meal * ENERGY_BAND[1]
    if totals["kcal"].amount >= calorie_cap:
        return []
    query = select(Food).options(
        selectinload(Food.nutrients),
        selectinload(Food.standard_mappings).selectinload(ProductStandardMapping.standard_food),
    ).where(Food.id.not_in([item.food_id for item in request.items]))
    if request.recommendation_scope == "CU_ONLY":
        # Match the existing product-search visibility rule.
        query = query.where(Food.source_type == "CU_PRODUCT", Food.item_report_no.is_not(None))
    else:
        query = query.where(Food.source_type.in_(["CU_PRODUCT", "STANDARD_FOOD"]))
    ranked = []
    for food in db.scalars(query.order_by(Food.id)).all():
        if not number(food.serving_amount) or (food.serving_unit or "").lower() not in {"g", "ml"}:
            continue
        values = read_values(food, 1.0)
        # Score only candidates with every deficit and their energy known.
        if any(values[key].amount is None for key in {*deficits, "kcal"}):
            continue
        if totals["kcal"].amount + values["kcal"].amount > calorie_cap:
            continue
        # Do not add a candidate that crosses a known daily UL, or whose contribution
        # to an otherwise evaluable UL nutrient is missing. Unknown meal totals remain
        # unknown: suggestions are not a guarantee of overall nutritional safety.
        if any(t.daily_ul is not None and totals[k].amount is not None and
               (values[k].amount is None or totals[k].amount + values[k].amount > t.daily_ul)
               for k, t in targets.items()):
            continue
        carb = targets["carbohydrate"]
        if (totals["carbohydrate"].amount is not None and
                (values["carbohydrate"].amount is None or
                 totals["carbohydrate"].amount + values["carbohydrate"].amount > carb.planning_range[1])):
            continue
        # Dimensionless, equal weights; no extra credit beyond remaining target.
        gains = {k: min(values[k].amount, gap) / targets[k].per_meal for k, gap in deficits.items()}
        score = sum(gains.values()) / len(deficits)
        if score <= 0:
            continue
        reason_keys = sorted(k for k, gain in gains.items() if gain > 0)
        estimated = any(v.amount is not None and v.quality != "CONFIRMED" for v in values.values())
        ranked.append((score, food.id, food, values, reason_keys, estimated))
    ranked.sort(key=lambda r: (-r[0], r[1]))
    return [Recommendation(
        food=food_response(food, values), reason_nutrients=keys, score=rounded(score, 4),
        message=(f"1회 제공량 기준 {', '.join(keys)}의 남은 한 끼 계획량을 보완합니다. "
                 + ("추정 성분값을 포함한 추천입니다." if estimated else "확인된 성분값으로 비교했습니다.")),
    ) for score, _, food, values, keys, estimated in ranked[:3]]


# 4. 기존 REST API 진입점

def analyze_meal(request: MealAnalyzeRequest, db: Session) -> MealAnalysisResponse:
    """Maintain the JSON contract; all implementation stays inside nutrition/."""
    food_ids = [item.food_id for item in request.items]
    foods = db.scalars(select(Food).options(selectinload(Food.nutrients))
                       .where(Food.id.in_(food_ids))).all()
    foods_by_id = {food.id: food for food in foods}
    missing_ids = sorted(set(food_ids) - foods_by_id.keys())
    if missing_ids:
        raise ValueError(f"등록되지 않은 상품입니다: {', '.join(missing_ids)}")

    targets, trace = build_targets(request.profile)
    warnings = [
        AnalysisWarning(code="REFERENCE_VERSION", message=REFERENCE_VERSION),
        AnalysisWarning(code="ACTIVITY_ASSUMED", message=(
            f"활동량 입력이 없어 저활동적 PA={trace['pa']}를 가정했습니다. "
            "개인의 실제 활동량을 측정한 값이 아닙니다.")),
        AnalysisWarning(code="ENERGY_CALCULATION", message=(
            f"EER = {trace['formula']} = {rounded(trace['daily_kcal'])} kcal/일; "
            f"한 끼 목표 = 일일 목표 / {request.profile.meals_per_day}.")),
        AnalysisWarning(code="MEAL_PLANNING_POLICY", message=(
            "한 끼 균등 배분은 서비스 정책입니다. LOW/ADEQUATE/HIGH는 계획량 비교이며 "
            "영양 결핍이나 과잉 진단이 아닙니다. 에너지 80-120% 범위도 서비스 정책입니다.")),
        AnalysisWarning(code="DAILY_UL_NOT_MEAL_LIMIT", message=(
            "칼슘, 비타민 C와 D의 upperLimit은 하루 상한섭취량입니다. "
            "다른 식사와 보충제는 합산되지 않아 하루 초과 여부를 확정할 수 없습니다.")),
        AnalysisWarning(code="VITAMIN_A_UL_NOT_ASSESSED", message=(
            "비타민 A 총 RAE에는 카로티노이드가 포함될 수 있어 레티놀 상한과 직접 비교하지 않습니다. "
            "upperLimit=null은 상한이 없다는 의미가 아닙니다.")),
        AnalysisWarning(code="OUT_OF_SCOPE_REFERENCE", message=(
            "철분과 나트륨은 기존 JSON 키와 섭취량만 유지합니다. 이번 평가 기준 범위 밖이므로 "
            "target/ratio/upperLimit=null, status=UNKNOWN입니다.")),
        AnalysisWarning(code="CARBOHYDRATE_PLANNING_RANGE", message=(
            "탄수화물 target은 EER의 50-65%를 4 kcal/g으로 환산한 계획범위 중간값입니다. "
            "실제 섭취 에너지 비율이나 130g/일 권장섭취량과는 구분합니다.")),
    ]
    if targets["carbohydrate"].daily < trace["carbohydrate_rni_g"]:
        warnings.append(AnalysisWarning(code="ENERGY_REFERENCE_CONFLICT", message=(
            "입력 체위로 계산한 탄수화물 계획량이 130g/일 권장섭취량보다 낮습니다. "
            "키와 몸무게를 확인하고 개별 식사계획을 검토해야 합니다. 탄수화물 상태 판정과 자동 추천을 보류합니다.")))
    item_values, resolved_items, prices = [], [], []
    for item in request.items:
        food = foods_by_id[item.food_id]
        factor, amount, unit = serving_factor(food, item)
        values = read_values(food, factor)
        item_values.append(values)
        price = number(food.price)
        line_price = (int(rounded(price * factor, 0))
                      if price is not None and factor is not None else None)
        prices.append(line_price)
        resolved_items.append(ResolvedMealItem(
            food_id=item.food_id, name=food.name, quantity=item.quantity,
            quantity_unit=item.quantity_unit,
            resolved_amount=Serving(amount=rounded(amount, 3), unit=unit,
                                    count_unit=food.count_unit, label=food.serving_label),
            price=line_price,
        ))
        if factor is None:
            warnings.append(AnalysisWarning(code="QUANTITY_CONVERSION_UNAVAILABLE",
                food_id=food.id, message="제공량 또는 단위가 맞지 않아 환산할 수 없습니다. g와 ml를 동일시하지 않습니다."))
        missing = [f"{key}: {v.problem}" for key, v in values.items() if v.amount is None]
        if missing:
            warnings.append(AnalysisWarning(code="NUTRIENT_DATA_MISSING", food_id=food.id,
                message="; ".join(missing)))

    totals = {key: aggregate([v[key] for v in item_values]) for key in NUTRIENT_UNITS}
    nutrients = {}
    for key, unit in NUTRIENT_UNITS.items():
        value, target = totals[key], targets.get(key)
        ratio, status = assess(value, target)
        if key == "carbohydrate" and targets[key].daily < trace["carbohydrate_rni_g"]:
            status = "UNKNOWN"
        nutrients[key] = NutrientAssessment(
            actual=rounded(value.amount), target=rounded(target.per_meal) if target else None,
            upper_limit=target.daily_ul if target else None, unit=unit,
            ratio=rounded(ratio, 4), status=status, quality=value.quality,
        )
    if totals["vitaminD"].amount is not None and nutrients["vitaminD"].status == "UNKNOWN":
        warnings.append(AnalysisWarning(code="AI_BELOW_NOT_DIAGNOSIS", message=(
            "비타민 D 섭취량이 배분된 충분섭취량보다 낮지만, 이것만으로 부족을 판정할 수 없습니다.")))
    if any(v.quality in {"ESTIMATED", "MIXED"} for v in totals.values()):
        warnings.append(AnalysisWarning(code="ESTIMATED_NUTRIENTS", message=(
            "추정 성분값이 포함됩니다. quality는 섭취 성분 데이터 품질이며 목표량의 정확도를 뜻하지 않습니다.")))
    recommendations = (recommend(db, request, totals, targets)
                       if targets["carbohydrate"].daily >= trace["carbohydrate_rni_g"] else [])
    if recommendations:
        warnings.append(AnalysisWarning(code="RECOMMENDATION_POLICY", message=(
            "추천 점수는 부족한 계획량을 보완하는 비율의 평균(서비스 정책)입니다. "
            "각 후보 1회 제공량을 개별 비교하며 여러 후보의 동시 섭취를 제안하지 않습니다. "
            "철분과 나트륨, 알레르기, 질환, 재고는 평가하지 않습니다.")))
    elif any(n.status == "LOW" for n in nutrients.values()):
        warnings.append(AnalysisWarning(code="NO_ELIGIBLE_RECOMMENDATION", message=(
            "보완이 가능한 계획량이 있으나 데이터, 범위와 추가 열량 조건을 만족하는 추천 후보가 없습니다.")))
    if any(p is None for p in prices):
        warnings.append(AnalysisWarning(code="PRICE_UNAVAILABLE", message="일부 가격 또는 섭취량 환산이 미확인되어 totalPrice=null입니다."))
    return MealAnalysisResponse(
        analysis_id=f"analysis_{uuid4().hex}", meal_type=request.meal_type,
        items=resolved_items, total_price=sum(prices) if all(p is not None for p in prices) else None,
        nutrients=nutrients, recommendations=recommendations, warnings=warnings,
    )
