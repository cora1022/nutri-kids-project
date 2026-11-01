from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    app_name: str = "든든 API"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./nutrikids.db"
    cors_origins: str = "http://localhost:5173"
    auto_create_tables: bool = True
    frontend_url: str = "http://localhost:5173"
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:5173/api/v1/auth/google/callback"
    oauth_session_secret: str = ""
    cookie_secure: bool = False
    session_days: int = Field(default=7, ge=1, le=30)
    mfds_service_key: str = ""
    mfds_api_url: str = (
        "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/"
        "getFoodNtrCpntDbInq02"
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret and self.oauth_session_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
