from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.errors import not_implemented
from app.schemas.common import ErrorResponse
from app.schemas.meal import (
    DailyMealResponse,
    MealAnalysisResponse,
    MealAnalyzeRequest,
    MealCreateRequest,
    MealResponse,
)
from app.services.nutrition import analyze_meal as analyze_meal_service


router = APIRouter(prefix="/meals", tags=["meals"])


@router.post(
    "/analyze",
    response_model=MealAnalysisResponse,
    responses={501: {"model": ErrorResponse}},
)
def analyze_meal(request: MealAnalyzeRequest, db: Session = Depends(get_db)) -> MealAnalysisResponse:
    try:
        return analyze_meal_service(request, db)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


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
