import os
import tempfile
from pathlib import Path
from uuid import uuid4


TEST_DB = Path(tempfile.gettempdir()) / f"nutrikids_test_{uuid4().hex}.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"

from fastapi.testclient import TestClient

from app.database import engine
from app.main import app


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def teardown_module() -> None:
    engine.dispose()
    TEST_DB.unlink(missing_ok=True)
