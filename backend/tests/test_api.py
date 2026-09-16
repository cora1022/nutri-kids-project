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
