from dataclasses import dataclass
from urllib.parse import unquote

import httpx

from app.config import settings


@dataclass(frozen=True)
class MfdsFood:
    food_name: str
    maker_name: str | None
    item_report_no: str | None
    basis_amount: float
    basis_unit: str
    nutrients_per_basis: dict[str, float | None]


def _number(value: object) -> float | None:
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _basis(item: dict) -> tuple[float, str]:
    raw = str(item.get("SERVING_SIZE") or "100g").strip().lower()
    if raw.endswith("ml"):
        return _number(raw[:-2]) or 100.0, "ml"
    if raw.endswith("g"):
        return _number(raw[:-1]) or 100.0, "g"
    return 100.0, "g"


def parse_food(item: dict) -> MfdsFood:
    amount, unit = _basis(item)
    # 공개 명세에서 확인한 필드만 사용한다. 나머지는 추정하지 않고 미확인으로 남긴다.
    return MfdsFood(
        food_name=str(item.get("FOOD_NM_KR") or "").strip(),
        maker_name=(str(item.get("MAKER_NM")).strip() if item.get("MAKER_NM") else None),
        item_report_no=(
            str(item.get("ITEM_REPORT_NO")).strip() if item.get("ITEM_REPORT_NO") else None
        ),
        basis_amount=amount,
        basis_unit=unit,
        nutrients_per_basis={
            "kcal": _number(item.get("AMT_NUM1")),
            "protein": _number(item.get("AMT_NUM3")),
            "sodium": _number(item.get("AMT_NUM13")),
        },
    )


class MfdsClient:
    def __init__(self, service_key: str | None = None) -> None:
        self.service_key = unquote(service_key or settings.mfds_service_key)

    def search(self, food_name: str, maker_name: str | None = None, size: int = 10) -> list[MfdsFood]:
        if not self.service_key:
            return []
        params = {
            "serviceKey": self.service_key,
            "pageNo": 1,
            "numOfRows": size,
            "type": "json",
            "FOOD_NM_KR": food_name,
        }
        if maker_name:
            params["MAKER_NM"] = maker_name
        response = httpx.get(settings.mfds_api_url, params=params, timeout=30)
        response.raise_for_status()
        payload = response.json()
        if payload.get("header", {}).get("resultCode") != "00":
            return []
        items = payload.get("body", {}).get("items") or []
        if isinstance(items, dict):
            items = items.get("item") or []
        return [parse_food(item) for item in items]
