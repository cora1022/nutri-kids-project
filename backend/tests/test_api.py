import os
import tempfile
from pathlib import Path
from uuid import uuid4


TEST_DB = Path(tempfile.gettempdir()) / f"nutrikids_test_{uuid4().hex}.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"

from fastapi.testclient import TestClient

from app.database import engine
from app.database import SessionLocal
from app.main import app
from app.models import Food, FoodNutrient
from app.services.mfds import parse_food
from app.services.standard_foods import estimate_serving, match_standard_food, normalize_product_name


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_empty_food_search_contract() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/foods", params={"query": "우유"})
    assert response.status_code == 200
    assert response.json() == {
        "items": [],
        "page": 1,
        "size": 20,
        "total": 0,
        "hasNext": False,
    }


def test_mfds_response_parser_uses_declared_basis() -> None:
    food = parse_food({
        "FOOD_NM_KR": "테스트 과자", "SERVING_SIZE": "100g",
        "NUTRI_AMOUNT_SERVING": "30g", "ITEM_REPORT_NO": "TEST-1",
        "AMT_NUM1": "420", "AMT_NUM3": "4", "AMT_NUM13": "130",
    })
    assert food.basis_amount == 100
    assert food.nutrients_per_basis == {"kcal": 420, "protein": 4, "sodium": 130}


def test_standard_food_normalization_and_matching() -> None:
    assert normalize_product_name("오뚜기)참깨라면110g") == "참깨라면"
    rule = match_standard_food("오뚜기)참깨라면110g", "식품")
    assert rule is not None
    assert rule.food_code == "3142"


def test_serving_estimate_uses_package_amount_or_standard_basis() -> None:
    package = estimate_serving("서울)딸기우유300ml", "음료")
    fallback = estimate_serving("샐)허니리코타치즈샐러드", "간편식사")
    assert (package.amount, package.unit, package.from_product_name) == (300, "ml", True)
    assert (fallback.amount, fallback.unit, fallback.from_product_name) == (100, "g", False)


def test_food_search_promotes_first_similar_report_number() -> None:
    with SessionLocal() as db:
        db.add(Food(
            id="cu:candidate", source_type="CU_PRODUCT", name="후보 상품", brand="CU",
            category="간편식사", price=1800,
            item_report_candidates=["202400000001", "202400000002"],
            item_report_no="202400000001",
            item_report_status="상품명 유사 자동 확정",
            item_report_evidence="제품명 기준 후보. 복수 후보 중 첫 번째 번호를 대표값으로 자동 확정",
        ))
        db.commit()

    with TestClient(app) as client:
        response = client.get("/api/v1/foods", params={"query": "후보 상품"})

    item = response.json()["items"][0]
    assert item["itemReportNo"] == "202400000001"
    assert item["itemReportCandidates"] == ["202400000001", "202400000002"]
    assert item["itemReportStatus"] == "상품명 유사 자동 확정"


def test_food_search_excludes_products_without_report_number() -> None:
    with SessionLocal() as db:
        db.add(Food(
            id="cu:no-report", source_type="CU_PRODUCT", name="번호 없는 검색 상품",
            brand="CU", category="간편식사", price=1500,
        ))
        db.commit()

    with TestClient(app) as client:
        response = client.get("/api/v1/foods", params={"query": "번호 없는 검색 상품"})

    assert response.status_code == 200
    assert response.json()["total"] == 0
    assert response.json()["items"] == []


def test_meal_analysis_preserves_missing_values() -> None:
    with SessionLocal() as db:
        db.add(Food(
            id="cu:test", source_type="CU_PRODUCT", name="테스트 상품", brand="테스트",
            category="식품", price=1000, serving_amount=100, serving_unit="g",
            count_unit="개", serving_label="100g",
        ))
        db.add(FoodNutrient(
            food_id="cu:test", nutrient_key="kcal", value=100, unit="kcal",
            quality="CONFIRMED", source="MFDS",
        ))
        db.commit()

    payload = {
        "mealType": "LUNCH", "eatenAt": "2026-09-16T12:00:00+09:00",
        "profile": {"sex": "MALE", "age": 10, "heightCm": 140,
                    "weightKg": 38, "mealsPerDay": 3},
        "items": [{"foodId": "cu:test", "quantity": 1, "quantityUnit": "SERVING"}],
        "recommendationScope": "CU_ONLY",
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/meals/analyze", json=payload)
    assert response.status_code == 200
    nutrients = response.json()["nutrients"]
    assert nutrients["kcal"]["actual"] == 100
    assert nutrients["protein"]["actual"] is None
    assert nutrients["protein"]["status"] == "UNKNOWN"
    assert nutrients["protein"]["quality"] == "MISSING"


def teardown_module() -> None:
    engine.dispose()
    TEST_DB.unlink(missing_ok=True)
