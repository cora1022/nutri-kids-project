from enum import StrEnum

from pydantic import Field

from app.schemas.common import APIModel


class Sex(StrEnum):
    MALE = "MALE"
    FEMALE = "FEMALE"


class GoalType(StrEnum):
    TARGET = "TARGET"
    UPPER_LIMIT = "UPPER_LIMIT"


class GoalValue(APIModel):
    value: float
    unit: str
    type: GoalType


class ProfileUpsertRequest(APIModel):
    nickname: str = Field(min_length=1, max_length=40)
    sex: Sex
    age: int = Field(ge=6, le=18)
    height_cm: float = Field(gt=80, le=230)
    weight_kg: float = Field(gt=20, le=250)
    meals_per_day: int = Field(ge=1, le=6)


class ProfileData(ProfileUpsertRequest):
    pass


class NutritionGoals(APIModel):
    method: str
    daily: dict[str, GoalValue]
    per_meal: dict[str, GoalValue]


class ProfileResponse(APIModel):
    profile: ProfileData
    goals: NutritionGoals

