import os
import tempfile
from pathlib import Path
from uuid import uuid4


TEST_DB = Path(tempfile.gettempdir()) / f"nutrikids_test_{uuid4().hex}.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"

from fastapi.testclient import TestClient

from app.database import engine
from app.main import app
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


def teardown_module() -> None:
    engine.dispose()
    TEST_DB.unlink(missing_ok=True)
