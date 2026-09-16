from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.routers.errors import not_implemented
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse
from app.schemas.common import ErrorResponse


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=201,
    responses={501: {"model": ErrorResponse}},
)
def signup(_: SignupRequest) -> TokenResponse | JSONResponse:
    return not_implemented("회원가입")


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={501: {"model": ErrorResponse}},
)
def login(_: LoginRequest) -> TokenResponse | JSONResponse:
    return not_implemented("로그인")

