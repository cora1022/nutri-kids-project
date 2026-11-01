from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Profile, User
from app.schemas.profile import (
    GoalValue, NutritionGoals, ProfileData, ProfileResponse, ProfileUpsertRequest,
)
from app.services.accounts import auth_user, require_current_user
from app.services.nutrition.engine import NUTRIENT_UNITS, REFERENCE_VERSION, build_targets, rounded

router = APIRouter(prefix="/users", tags=["users"])


def profile_response(user: User) -> ProfileResponse:
    profile = user.profile
    if profile is None:
        return ProfileResponse(user=auth_user(user), profile=None, goals=None)
    data = ProfileData(nickname=user.nickname, sex=profile.sex, age=profile.age,
                       height_cm=profile.height_cm, weight_kg=profile.weight_kg,
                       meals_per_day=profile.meals_per_day)
    targets, _ = build_targets(data)

    def goal_values(daily: bool) -> dict[str, GoalValue]:
        return {
            key: GoalValue(value=rounded(targets[key].daily if daily else targets[key].per_meal)
                           if key in targets else None, unit=unit, type="TARGET")
            for key, unit in NUTRIENT_UNITS.items()
        }

    return ProfileResponse(user=auth_user(user), profile=data,
        goals=NutritionGoals(method=REFERENCE_VERSION, daily=goal_values(True), per_meal=goal_values(False)))


@router.get("/me", response_model=ProfileResponse)
def get_me(user: User = Depends(require_current_user)) -> ProfileResponse:
    return profile_response(user)


@router.put("/me/profile", response_model=ProfileResponse)
def update_profile(request: ProfileUpsertRequest, db: Session = Depends(get_db),
                   user: User = Depends(require_current_user)) -> ProfileResponse:
    try:
        build_targets(request)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    values = request.model_dump(exclude={"nickname"})
    user.nickname = request.nickname
    if user.profile is None:
        user.profile = Profile(**values)
    else:
        for key, value in values.items():
            setattr(user.profile, key, value)
    db.commit()
    return profile_response(user)
