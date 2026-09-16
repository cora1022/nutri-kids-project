from fastapi.responses import JSONResponse

from app.schemas.common import ErrorResponse


def not_implemented(feature: str) -> JSONResponse:
    error = ErrorResponse(
        code="NOT_IMPLEMENTED",
        message=f"{feature} 기능은 API 계약만 구성된 상태입니다.",
    )
    return JSONResponse(status_code=501, content=error.model_dump(by_alias=True))

