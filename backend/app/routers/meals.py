from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Meal, User
from app.schemas.meal import (
    DailyMealResponse, MealAnalysisResponse, MealAnalyzeRequest, MealCreateRequest, MealResponse,
)
from app.services import meal_records
from app.services.accounts import require_current_user
from app.services.nutrition import analyze_meal as analyze_meal_service

router = APIRouter(prefix="/meals", tags=["meals"])


@router.post("/analyze", response_model=MealAnalysisResponse)
def analyze_meal(request: MealAnalyzeRequest, db: Session = Depends(get_db)) -> MealAnalysisResponse:
    try:
        return analyze_meal_service(request, db)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("", response_model=MealResponse, status_code=201)
def save_meal(request: MealCreateRequest, response: Response,
              db: Session = Depends(get_db), user: User = Depends(require_current_user)) -> MealResponse:
    result, created = meal_records.save_meal(db, user, request)
    response.status_code = 201 if created else 200
    return result


@router.get("/daily/{target_date}", response_model=DailyMealResponse)
def get_daily_meals(target_date: date, db: Session = Depends(get_db),
                    user: User = Depends(require_current_user)) -> DailyMealResponse:
    return meal_records.daily_meals(db, user, target_date)


@router.get("/{meal_id}", response_model=MealResponse)
def get_meal(meal_id: str, db: Session = Depends(get_db),
             user: User = Depends(require_current_user)) -> MealResponse:
    meal = db.scalar(select(Meal).where(Meal.id == meal_id, Meal.user_id == user.id))
    if meal is None:
        raise HTTPException(404, "식사 기록을 찾을 수 없습니다.")
    return meal_records.as_response(meal)
