from datetime import date, datetime
from enum import StrEnum

from pydantic import Field

from app.schemas.common import APIModel, NutrientQuality
from app.schemas.food import FoodResponse, Serving
from app.schemas.profile import Sex


class MealType(StrEnum):
    BREAKFAST = "BREAKFAST"
    LUNCH = "LUNCH"
    DINNER = "DINNER"
    SNACK = "SNACK"


class QuantityUnit(StrEnum):
    SERVING = "SERVING"
    GRAM = "GRAM"
    MILLILITER = "MILLILITER"


class RecommendationScope(StrEnum):
    CU_ONLY = "CU_ONLY"
    ALL = "ALL"


class NutrientStatus(StrEnum):
    LOW = "LOW"
    ADEQUATE = "ADEQUATE"
    HIGH = "HIGH"
    UNKNOWN = "UNKNOWN"


class MealItemRequest(APIModel):
    food_id: str
    quantity: float = Field(gt=0, le=10000)
    quantity_unit: QuantityUnit


class AnalysisProfile(APIModel):
    sex: Sex
    age: int = Field(ge=6, le=18)
    height_cm: float = Field(gt=80, le=230)
    weight_kg: float = Field(gt=20, le=250)
    meals_per_day: int = Field(ge=1, le=6)


class MealAnalyzeRequest(APIModel):
    meal_type: MealType
    eaten_at: datetime
    items: list[MealItemRequest] = Field(min_length=1, max_length=30)
    recommendation_scope: RecommendationScope = RecommendationScope.CU_ONLY
    profile: AnalysisProfile


class ResolvedMealItem(APIModel):
    food_id: str
    name: str
    quantity: float
    quantity_unit: QuantityUnit
    resolved_amount: Serving | None = None
    price: int | None = None


class NutrientAssessment(APIModel):
    actual: float | None
    target: float | None = None
    upper_limit: float | None = None
    unit: str
    ratio: float | None
    status: NutrientStatus
    quality: NutrientQuality


class Recommendation(APIModel):
    food: FoodResponse
    reason_nutrients: list[str]
    message: str
    score: float


class AnalysisWarning(APIModel):
    code: str
    message: str
    food_id: str | None = None


class MealAnalysisResponse(APIModel):
    analysis_id: str
    meal_type: MealType
    items: list[ResolvedMealItem]
    total_price: int | None
    nutrients: dict[str, NutrientAssessment]
    recommendations: list[Recommendation]
    warnings: list[AnalysisWarning]


class MealCreateRequest(MealAnalyzeRequest):
    client_request_id: str = Field(min_length=8, max_length=64)


class MealResponse(APIModel):
    id: str
    client_request_id: str
    meal_type: MealType
    eaten_at: datetime
    saved_at: datetime
    items: list[ResolvedMealItem]
    analysis: MealAnalysisResponse


class MealSummary(APIModel):
    id: str
    meal_type: MealType
    eaten_at: datetime
    item_names: list[str]
    total_price: int | None


class DailyAnalysis(APIModel):
    nutrients: dict[str, NutrientAssessment]
    warnings: list[AnalysisWarning]


class DailyMealResponse(APIModel):
    date: date
    recorded_meal_count: int
    expected_meal_count: int
    is_partial: bool
    meals: list[MealSummary]
    daily_analysis: DailyAnalysis
