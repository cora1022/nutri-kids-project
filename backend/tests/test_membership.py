from datetime import timedelta
from hashlib import sha256
import time
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient
from joserfc import jwt
from joserfc.jwk import RSAKey
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models import Food, FoodNutrient, GoogleAccount, LoginSession, Meal, User
from app.routers.auth import oauth
from app.services.accounts import SESSION_COOKIE, utc_now

ORIGIN = {"Origin": "http://localhost:5173"}
PROFILE = {"nickname": "든든친구", "sex": "MALE", "age": 14,
           "heightCm": 165, "weightKg": 55, "mealsPerDay": 3}


@pytest.fixture
def db_factory(monkeypatch):
    monkeypatch.setattr(settings, "auto_create_tables", False)
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    @event.listens_for(engine, "connect")
    def enforce_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)

    def db_dependency():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = db_dependency
    yield factory
    app.dependency_overrides.clear()
    engine.dispose()



@pytest.fixture
def google(monkeypatch):
    """가짜 Google HTTP 응답을 쓰되 Authlib의 state, nonce와 RSA 서명 검증은 실제 실행한다."""
    key = RSAKey.generate_key(2048, parameters={"kid": "test-key"}, private=True)
    provider = {"nonce": "", "subject": "1234567890", "email": "member@example.com",
                "verified": True, "change": {}, "token_calls": 0, "bad_signature": False}
    metadata = {
        "issuer": "https://accounts.google.com",
        "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_endpoint": "https://oauth2.googleapis.com/token",
        "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs",
        "id_token_signing_alg_values_supported": ["RS256"],
        "_loaded_at": time.time(),
    }

    def handle(request: httpx.Request):
        if str(request.url) == metadata["jwks_uri"]:
            return httpx.Response(200, json={"keys": [key.as_dict(private=False)]})
        assert str(request.url) == metadata["token_endpoint"]
        provider["token_calls"] += 1
        form = parse_qs(request.content.decode())
        verifier = form["code_verifier"][0]
        import base64
        challenge = base64.urlsafe_b64encode(sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        assert challenge == provider["challenge"]
        claims = {"iss": metadata["issuer"], "aud": "test-client", "sub": provider["subject"],
                  "iat": int(time.time()), "exp": int(time.time()) + 3600,
                  "nonce": provider["nonce"], "email": provider["email"],
                  "email_verified": provider["verified"], "name": "테스트 회원", **provider["change"]}
        signing_key = RSAKey.generate_key(2048, private=True) if provider["bad_signature"] else key
        token = jwt.encode({"alg": "RS256", "kid": "test-key"}, claims, signing_key)
        return httpx.Response(200, json={"access_token": "provider-access", "token_type": "Bearer",
                                        "expires_in": 3600, "id_token": token})

    monkeypatch.setattr(settings, "google_client_id", "test-client")
    monkeypatch.setattr(settings, "google_client_secret", "test-secret")
    monkeypatch.setattr(settings, "oauth_session_secret", "test-only-secret")
    monkeypatch.setattr(oauth.google, "client_id", "test-client")
    monkeypatch.setattr(oauth.google, "client_secret", "test-secret")
    monkeypatch.setattr(oauth.google, "server_metadata", metadata)
    monkeypatch.setitem(oauth.google.client_kwargs, "transport", httpx.MockTransport(handle))
    return provider



def begin_login(client, provider, consent=True):
    response = client.get(f"/api/v1/auth/google/login?consent={str(consent).lower()}", follow_redirects=False)
    assert response.status_code == 302
    params = parse_qs(urlparse(response.headers["location"]).query)
    provider["nonce"] = params["nonce"][0]
    provider["challenge"] = params["code_challenge"][0]
    assert params["code_challenge_method"] == ["S256"]
    return params["state"][0]



def login(client, provider):
    state = begin_login(client, provider)
    response = client.get("/api/v1/auth/google/callback", params={"code": "test-code", "state": state},
                          follow_redirects=False)
    assert response.status_code == 303
    assert "authError" not in response.headers["location"]
    return response



def test_login_profile_logout_and_session_storage(db_factory, google):
    with TestClient(app) as client:
        assert client.get("/api/v1/users/me").status_code == 401
        response = login(client, google)
        cookie = response.headers["set-cookie"]
        assert "HttpOnly" in cookie and "SameSite=lax" in cookie
        me = client.get("/api/v1/users/me")
        assert me.headers["cache-control"] == "no-store"
        assert me.json()["profile"] is None
        token = client.cookies.get(SESSION_COOKIE)
        with db_factory() as db:
            stored = db.scalar(select(LoginSession))
            assert stored.token_hash == sha256(token.encode()).hexdigest()
            assert db.scalar(select(func.count()).select_from(GoogleAccount)) == 1
        saved = client.put("/api/v1/users/me/profile", json=PROFILE, headers=ORIGIN)
        assert saved.status_code == 200
        assert saved.json()["profile"]["nickname"] == PROFILE["nickname"]
        assert saved.json()["goals"]["daily"]["kcal"]["value"] == pytest.approx(2589.95)
        assert client.get("/api/v1/users/me").json()["user"]["profileCompleted"] is True
        assert client.post("/api/v1/auth/logout", headers=ORIGIN).status_code == 204
        assert client.get("/api/v1/users/me").status_code == 401
        with db_factory() as db:
            assert db.scalar(select(func.count()).select_from(LoginSession)) == 0



@pytest.mark.parametrize("change", [
    {"aud": "wrong-client"}, {"iss": "https://attacker.example"}, {"nonce": "wrong-nonce"},
    {"exp": int(time.time()) - 600},
])
def test_invalid_id_token_is_rejected(db_factory, google, change):
    google["change"] = change
    with TestClient(app) as client:
        state = begin_login(client, google)
        result = client.get("/api/v1/auth/google/callback", params={"code": "x", "state": state},
                            follow_redirects=False)
        assert "authError" in result.headers["location"]
        assert client.get("/api/v1/users/me").status_code == 401
    with db_factory() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 0



def test_bad_signature_and_forged_state_are_rejected(db_factory, google):
    with TestClient(app) as client:
        state = begin_login(client, google)
        response = client.get("/api/v1/auth/google/callback", params={"code": "x", "state": "forged"},
                              follow_redirects=False)
        assert "authError" in response.headers["location"]
        assert google["token_calls"] == 0
        state = begin_login(client, google)
        google["bad_signature"] = True
        response = client.get("/api/v1/auth/google/callback", params={"code": "x", "state": state},
                              follow_redirects=False)
        assert "authError" in response.headers["location"]
        assert client.get("/api/v1/users/me").status_code == 401



def test_consent_and_verified_email_are_required(db_factory, google):
    with TestClient(app) as client:
        for consent, verified in [(False, True), (True, False)]:
            google["verified"] = verified
            state = begin_login(client, google, consent)
            response = client.get("/api/v1/auth/google/callback", params={"code": "x", "state": state},
                                  follow_redirects=False)
            assert "authError" in response.headers["location"]
        assert client.get("/api/v1/users/me").status_code == 401



def test_sub_is_identity_and_email_collision_is_not_linked(db_factory, google):
    with TestClient(app) as client:
        login(client, google)
        user_id = client.get("/api/v1/users/me").json()["user"]["id"]
        client.post("/api/v1/auth/logout", headers=ORIGIN)
        google["email"] = "changed@example.com"
        login(client, google)
        assert client.get("/api/v1/users/me").json()["user"]["id"] == user_id
        client.post("/api/v1/auth/logout", headers=ORIGIN)
        google["subject"] = "different-subject"
        google["email"] = "member@example.com"
        state = begin_login(client, google)
        response = client.get("/api/v1/auth/google/callback", params={"code": "x", "state": state},
                              follow_redirects=False)
        assert "authError" in response.headers["location"]



def test_csrf_and_session_expiry(db_factory, google):
    with TestClient(app) as client:
        login(client, google)
        assert client.put("/api/v1/users/me/profile", json=PROFILE).status_code == 403
        assert client.post("/api/v1/auth/logout", headers={"Origin": "https://attacker.example"}).status_code == 403
        with db_factory() as db:
            session = db.scalar(select(LoginSession))
            session.expires_at = utc_now() - timedelta(seconds=1)
            db.commit()
        assert client.get("/api/v1/users/me").status_code == 401



def test_missing_oauth_configuration_is_explicit(db_factory, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "")
    with TestClient(app) as client:
        assert client.get("/api/v1/auth/config").json()["googleEnabled"] is False
        assert client.get("/api/v1/auth/google/login").status_code == 503
