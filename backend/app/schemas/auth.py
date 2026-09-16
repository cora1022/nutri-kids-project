from pydantic import EmailStr, Field

from app.schemas.common import APIModel


class ConsentRequest(APIModel):
    privacy_required: bool
    version: str


class SignupRequest(APIModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    nickname: str = Field(min_length=1, max_length=40)
    consent: ConsentRequest


class LoginRequest(APIModel):
    email: EmailStr
    password: str


class AuthUser(APIModel):
    id: str
    email: EmailStr
    nickname: str
    profile_completed: bool


class TokenResponse(APIModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: AuthUser

