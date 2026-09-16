from datetime import date

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.routers.errors import not_implemented
from app.schemas.common import ErrorResponse
from app.schemas.meal import (
    DailyMealResponse,
    MealAnalysisResponse,
    MealAnalyzeRequest,
    MealCreateRequest,
    MealResponse,
)


router = APIRouter(prefix="/meals", tags=["meals"])


@router.post(
    "/analyze",
    response_model=MealAnalysisResponse,
    responses={501: {"model": ErrorResponse}},
)
def analyze_meal(_: MealAnalyzeRequest) -> MealAnalysisResponse | JSONResponse:
    return not_implemented("한 끼 영양 분석과 추천")


@router.post(
    "",
    response_model=MealResponse,
    status_code=201,
    responses={501: {"model": ErrorResponse}},
)
def save_meal(_: MealCreateRequest) -> MealResponse | JSONResponse:
    return not_implemented("식사 저장")


@router.get(
    "/daily/{target_date}",
    response_model=DailyMealResponse,
    responses={501: {"model": ErrorResponse}},
)
def get_daily_meals(target_date: date) -> DailyMealResponse | JSONResponse:
    return not_implemented(f"{target_date.isoformat()} 하루 평가")
