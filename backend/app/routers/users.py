from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.routers.errors import not_implemented
from app.schemas.common import ErrorResponse
from app.schemas.profile import ProfileResponse, ProfileUpsertRequest


router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/me",
    response_model=ProfileResponse,
    responses={501: {"model": ErrorResponse}},
)
def get_me() -> ProfileResponse | JSONResponse:
    return not_implemented("프로필 조회")


@router.put(
    "/me/profile",
    response_model=ProfileResponse,
    responses={501: {"model": ErrorResponse}},
)
def update_profile(_: ProfileUpsertRequest) -> ProfileResponse | JSONResponse:
    return not_implemented("프로필 저장과 목표 계산")

