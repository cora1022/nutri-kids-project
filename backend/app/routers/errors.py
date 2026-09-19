from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.schemas.common import ErrorResponse, FieldError


FIELD_LABELS = {
    "age": "나이",
    "heightCm": "키",
    "weightKg": "몸무게",
    "mealsPerDay": "하루 식사 횟수",
    "sex": "성별",
    "items": "음식 목록",
    "quantity": "수량",
    "foodId": "음식",
    "mealType": "식사 종류",
    "eatenAt": "식사 시간",
}


def not_implemented(feature: str) -> JSONResponse:
    error = ErrorResponse(
        code="NOT_IMPLEMENTED",
        message=f"{feature} 기능은 API 계약만 구성된 상태입니다.",
    )
    return JSONResponse(status_code=501, content=error.model_dump(by_alias=True))


def _field_path(loc: tuple) -> str:
    parts = [str(part) for part in loc if part != "body"]
    return ".".join(parts) if parts else "body"


def _field_label(loc: tuple) -> str:
    for part in reversed(loc):
        if isinstance(part, str) and part in FIELD_LABELS:
            return FIELD_LABELS[part]
    return _field_path(loc)


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    field_errors = [
        FieldError(field=_field_path(tuple(item["loc"])), message=item["msg"])
        for item in exc.errors()
    ]
    labels = []
    for item in exc.errors():
        label = _field_label(tuple(item["loc"]))
        if label not in labels:
            labels.append(label)
    error = ErrorResponse(
        code="VALIDATION_ERROR",
        message=f"{', '.join(labels)} 값을 다시 확인해 주세요.",
        field_errors=field_errors,
    )
    return JSONResponse(status_code=422, content=error.model_dump(by_alias=True))
