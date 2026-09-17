"""API 계약만 유지하는 영양 분석 임시 엔진."""

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Food
from app.schemas.common import NutrientQuality
from app.schemas.meal import (
    AnalysisWarning,
    MealAnalysisResponse,
    MealAnalyzeRequest,
    NutrientAssessment,
    NutrientStatus,
    ResolvedMealItem,
)


NUTRIENT_UNITS = {
    "kcal": "kcal",
    "protein": "g",
    "calcium": "mg",
    "iron": "mg",
    "vitaminA": "µgRAE",
    "vitaminC": "mg",
    "sodium": "mg",
}


def analyze_meal(request: MealAnalyzeRequest, db: Session) -> MealAnalysisResponse:
    """입출력 스키마를 유지하고 미구현 상태를 명시적으로 반환한다."""
    food_ids = [item.food_id for item in request.items]
    foods = db.scalars(select(Food).where(Food.id.in_(food_ids))).all()
    foods_by_id = {food.id: food for food in foods}

    missing_ids = [food_id for food_id in food_ids if food_id not in foods_by_id]
    if missing_ids:
        raise ValueError(f"등록되지 않은 상품입니다: {', '.join(missing_ids)}")

    resolved_items = [
        ResolvedMealItem(
            food_id=item.food_id,
            name=foods_by_id[item.food_id].name,
            quantity=item.quantity,
            quantity_unit=item.quantity_unit,
            resolved_amount=None,
            price=None,
        )
        for item in request.items
    ]
    nutrients = {
        key: NutrientAssessment(
            actual=None,
            target=None,
            upper_limit=None,
            unit=unit,
            ratio=None,
            status=NutrientStatus.UNKNOWN,
            quality=NutrientQuality.MISSING,
        )
        for key, unit in NUTRIENT_UNITS.items()
    }

    return MealAnalysisResponse(
        analysis_id=f"analysis_{uuid4().hex}",
        meal_type=request.meal_type,
        items=resolved_items,
        total_price=None,
        nutrients=nutrients,
        recommendations=[],
        warnings=[
            AnalysisWarning(
                code="NUTRITION_ENGINE_PENDING",
                message="영양 평가와 추천 로직을 구현 중입니다.",
            )
        ],
    )
