from enum import StrEnum

from pydantic import Field

from app.schemas.common import APIModel, NutrientQuality, NutrientValue


class FoodSourceType(StrEnum):
    CU_PRODUCT = "CU_PRODUCT"
    STANDARD_FOOD = "STANDARD_FOOD"


class Serving(APIModel):
    amount: float | None
    unit: str | None
    count_unit: str | None
    label: str | None


class StandardFoodMatch(APIModel):
    food_code: str
    name: str
    match_method: str
    confidence: float


class FoodResponse(APIModel):
    id: str
    source_type: FoodSourceType
    name: str
    brand: str | None = None
    category: str | None = None
    price: int | None = None
    barcode: str | None = None
    image_url: str | None = None
    item_report_no: str | None = None
    serving: Serving
    nutrients: dict[str, NutrientValue]
    overall_quality: NutrientQuality
    standard_food_match: StandardFoodMatch | None = None


class FoodSearchResponse(APIModel):
    items: list[FoodResponse] = Field(default_factory=list)
    page: int
    size: int
    total: int
    has_next: bool
