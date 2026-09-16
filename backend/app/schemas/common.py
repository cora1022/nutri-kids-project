from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class APIModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class NutrientQuality(StrEnum):
    CONFIRMED = "CONFIRMED"
    ESTIMATED = "ESTIMATED"
    MIXED = "MIXED"
    MISSING = "MISSING"


class NutrientSource(StrEnum):
    MFDS = "MFDS"
    NATIONAL_STANDARD = "NATIONAL_STANDARD"
    MANUFACTURER = "MANUFACTURER"
    NONE = "NONE"


class NutrientValue(APIModel):
    value: float | None
    unit: str
    quality: NutrientQuality
    source: NutrientSource


class FieldError(APIModel):
    field: str
    message: str


class ErrorResponse(APIModel):
    code: str
    message: str
    field_errors: list[FieldError] = Field(default_factory=list)
    request_id: str | None = None
    details: dict[str, Any] | None = None

