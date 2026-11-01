from contextlib import asynccontextmanager
import secrets

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request

from app import models  # noqa: F401
from app.config import settings
from app.database import Base, engine
from app.routers import auth, foods, health, meals, users
from app.routers.errors import validation_error_handler


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="든든 프론트와 연결할 JSON API 계약 골격",
    lifespan=lifespan,
)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.oauth_session_secret or secrets.token_urlsafe(32),
    session_cookie="nutrikids_oauth",
    max_age=600,
    same_site="lax",
    https_only=settings.cookie_secure,
)


@app.middleware("http")
async def private_response_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    if any(request.url.path.startswith(f"{settings.api_prefix}/{prefix}")
           for prefix in ("auth", "users", "meals")):
        response.headers["Cache-Control"] = "no-store"
    return response


app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(users.router, prefix=settings.api_prefix)
app.include_router(foods.router, prefix=settings.api_prefix)
app.include_router(meals.router, prefix=settings.api_prefix)
