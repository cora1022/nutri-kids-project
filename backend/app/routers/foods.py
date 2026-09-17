from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Food, ProductStandardMapping
from app.schemas.common import NutrientQuality, NutrientSource, NutrientValue
from app.schemas.food import FoodResponse, FoodSearchResponse, FoodSourceType, Serving


router = APIRouter(prefix="/foods", tags=["foods"])

NUTRIENT_UNITS = {
    "kcal": "kcal",
    "protein": "g",
    "calcium": "mg",
    "iron": "mg",
    "vitaminA": "µgRAE",
    "vitaminC": "mg",
    "sodium": "mg",
}


def to_response(food: Food) -> FoodResponse:
    stored = {item.nutrient_key: item for item in food.nutrients}
    nutrients: dict[str, NutrientValue] = {}
    qualities: set[NutrientQuality] = set()
    for key, unit in NUTRIENT_UNITS.items():
        item = stored.get(key)
        if item is None:
            value = NutrientValue(
                value=None,
                unit=unit,
                quality=NutrientQuality.MISSING,
                source=NutrientSource.NONE,
            )
        else:
            value = NutrientValue(
                value=float(item.value) if item.value is not None else None,
                unit=item.unit,
                quality=NutrientQuality(item.quality),
                source=NutrientSource(item.source),
            )
        nutrients[key] = value
        qualities.add(value.quality)

    if qualities == {NutrientQuality.CONFIRMED}:
        overall = NutrientQuality.CONFIRMED
    elif qualities <= {NutrientQuality.ESTIMATED}:
        overall = NutrientQuality.ESTIMATED
    elif qualities == {NutrientQuality.MISSING}:
        overall = NutrientQuality.MISSING
    else:
        overall = NutrientQuality.MIXED

    mapping = food.standard_mappings[0] if food.standard_mappings else None
    standard_match = None
    if mapping:
        standard_match = {
            "food_code": mapping.standard_food_code,
            "name": mapping.standard_food.name,
            "match_method": mapping.match_method,
            "confidence": float(mapping.confidence),
        }

    return FoodResponse(
        id=food.id,
        source_type=FoodSourceType(food.source_type),
        name=food.name,
        brand=food.brand,
        category=food.category,
        price=food.price,
        barcode=food.barcode,
        image_url=food.image_url,
        item_report_no=food.item_report_no,
        item_report_candidates=food.item_report_candidates or [],
        item_report_status=food.item_report_status,
        item_report_evidence=food.item_report_evidence,
        serving=Serving(
            amount=float(food.serving_amount) if food.serving_amount is not None else None,
            unit=food.serving_unit,
            count_unit=food.count_unit,
            label=food.serving_label,
        ),
        nutrients=nutrients,
        overall_quality=overall,
        standard_food_match=standard_match,
    )


def food_query():
    return select(Food).options(
        selectinload(Food.nutrients),
        selectinload(Food.standard_mappings).selectinload(
            ProductStandardMapping.standard_food
        ),
    )


@router.get("", response_model=FoodSearchResponse)
def search_foods(
    query: str = Query(default="", max_length=100),
    source_type: FoodSourceType | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> FoodSearchResponse:
    conditions = [Food.item_report_no.is_not(None)]
    if query.strip():
        pattern = f"%{query.strip()}%"
        conditions.append(or_(Food.name.like(pattern), Food.brand.like(pattern)))
    if source_type:
        conditions.append(Food.source_type == source_type.value)

    total_query = select(func.count()).select_from(Food)
    items_query = food_query()
    for condition in conditions:
        total_query = total_query.where(condition)
        items_query = items_query.where(condition)

    total = db.scalar(total_query) or 0
    foods = db.scalars(
        items_query.order_by(Food.name).offset((page - 1) * size).limit(size)
    ).all()
    return FoodSearchResponse(
        items=[to_response(food) for food in foods],
        page=page,
        size=size,
        total=total,
        has_next=page * size < total,
    )


@router.get("/barcode/{barcode}", response_model=FoodResponse)
def find_by_barcode(barcode: str, db: Session = Depends(get_db)) -> FoodResponse:
    food = db.scalar(food_query().where(Food.barcode == barcode))
    if food is None:
        raise HTTPException(status_code=404, detail="등록된 상품을 찾을 수 없습니다.")
    return to_response(food)


@router.get("/{food_id}", response_model=FoodResponse)
def get_food(food_id: str, db: Session = Depends(get_db)) -> FoodResponse:
    food = db.scalar(food_query().where(Food.id == food_id))
    if food is None:
        raise HTTPException(status_code=404, detail="등록된 상품을 찾을 수 없습니다.")
    return to_response(food)
