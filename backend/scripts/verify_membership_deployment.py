"""운영 HTTP 경로와 MySQL 저장을 임시 검증 회원으로 확인하고 생성한 기록만 제거한다."""
from datetime import datetime, timezone
from http.cookies import SimpleCookie
import json
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import Response
from sqlalchemy import delete, func, select

from app.config import settings
from app.database import SessionLocal
from app.models import Food, GoogleAccount, LoginSession, Meal, MealItem, Profile, User
from app.services.accounts import SESSION_COOKIE, create_login_session


def main() -> None:
    if not settings.database_url.startswith("mysql") or not settings.cookie_secure:
        raise RuntimeError("This check expects the production MySQL and HTTPS configuration.")
    base = settings.frontend_url.rstrip("/")
    cookie_header = ""

    def request(method: str, path: str, payload=None):
        headers = {"Origin": base, "Accept": "application/json"}
        if cookie_header:
            headers["Cookie"] = cookie_header
        body = None if payload is None else json.dumps(payload).encode()
        if body is not None:
            headers["Content-Type"] = "application/json"
        req = Request(base + settings.api_prefix + path, data=body, headers=headers, method=method)
        try:
            with urlopen(req, timeout=30) as response:
                data = response.read()
                return response.status, json.loads(data) if data else None
        except HTTPError as error:
            return error.code, None

    identifier = uuid4().hex
    email = f"deployment-check-{identifier}@example.com"
    user_id = None
    with SessionLocal() as db:
        user = User(email=email, nickname="배포 검증용", password_hash="!deployment-check")
        db.add(user)
        db.commit()
        user_id = user.id
        try:
            assert request("GET", "/users/me")[0] == 401
            response = Response()
            create_login_session(db, user, response)
            cookies = SimpleCookie()
            cookies.load(response.headers["set-cookie"])
            cookie_header = f"{SESSION_COOKIE}={cookies[SESSION_COOKIE].value}"
            assert request("GET", "/users/me")[1]["user"]["id"] == user_id
            profile = {"nickname": "배포 검증용", "sex": "MALE", "age": 14,
                       "heightCm": 165, "weightKg": 55, "mealsPerDay": 3}
            status, result = request("PUT", "/users/me/profile", profile)
            assert status == 200 and result["user"]["profileCompleted"] is True
            food_id = db.scalar(select(Food.id).where(Food.item_report_no.is_not(None), Food.nutrients.any()).limit(1))
            assert food_id
            now = datetime.now(timezone.utc)
            payload = {"clientRequestId": f"deployment-{identifier}", "mealType": "LUNCH",
                "eatenAt": now.isoformat(), "profile": {k: v for k, v in profile.items() if k != "nickname"},
                "items": [{"foodId": food_id, "quantity": 1, "quantityUnit": "SERVING"}],
                "recommendationScope": "CU_ONLY"}
            status, saved = request("POST", "/meals", payload)
            assert status == 201, f"Meal save returned {status}"
            status, repeated = request("POST", "/meals", payload)
            assert status == 200 and repeated["id"] == saved["id"]
            status, detail = request("GET", f"/meals/{saved['id']}")
            assert status == 200 and detail["analysis"] == saved["analysis"]
            from zoneinfo import ZoneInfo
            day = now.astimezone(ZoneInfo("Asia/Seoul")).date().isoformat()
            status, daily = request("GET", f"/meals/daily/{day}")
            assert status == 200 and daily["recordedMealCount"] == 1
            assert len(daily["dailyAnalysis"]["nutrients"]) == 9
            assert request("POST", "/auth/logout")[0] == 204
            assert request("GET", "/users/me")[0] == 401
            print("PRODUCTION_MEMBERSHIP_CHECK_OK: profile, meal save, retry, detail, daily results and logout")
        finally:
            db.rollback()
            stored = db.get(User, user_id)
            if stored is None or stored.email != email or not email.startswith("deployment-check-"):
                raise RuntimeError("Synthetic user cleanup target verification failed.")
            meal_ids = select(Meal.id).where(Meal.user_id == user_id)
            db.execute(delete(MealItem).where(MealItem.meal_id.in_(meal_ids)))
            for model in (Meal, Profile, LoginSession, GoogleAccount):
                db.execute(delete(model).where(model.user_id == user_id))
            db.execute(delete(User).where(User.id == user_id, User.email == email))
            db.commit()
            remaining = db.scalar(select(func.count()).select_from(User).where(User.id == user_id))
            assert remaining == 0
            print("SYNTHETIC_RECORDS_REMOVED: no deployment test account or meal remains")


if __name__ == "__main__":
    main()
