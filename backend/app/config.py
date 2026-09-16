from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "든든 API"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./nutrikids.db"
    cors_origins: str = "http://localhost:5173"
    auto_create_tables: bool = True
    mfds_service_key: str = ""
    mfds_api_url: str = (
        "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/"
        "getFoodNtrCpntDbInq02"
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
