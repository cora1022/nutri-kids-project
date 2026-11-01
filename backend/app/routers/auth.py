from authlib.integrations.starlette_client import OAuth, OAuthError
from joserfc.errors import JoseError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from httpx import HTTPError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import LoginSession
from app.services.accounts import (
    CONSENT_VERSION, SESSION_COOKIE, create_login_session, google_user,
    require_origin, token_hash,
)

router = APIRouter(prefix="/auth", tags=["auth"])
oauth = OAuth()
oauth.register(
    name="google", client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"},
)


@router.get("/config")
def auth_config() -> dict:
    return {"googleEnabled": settings.google_enabled, "consentVersion": CONSENT_VERSION}


@router.get("/google/login")
async def google_login(request: Request, consent: bool = False):
    if not settings.google_enabled:
        raise HTTPException(503, "구글 로그인 설정을 준비 중입니다.")
    request.session.clear()
    if consent:
        request.session["consent_version"] = CONSENT_VERSION
    try:
        response = await oauth.google.authorize_redirect(request, settings.google_redirect_uri)
    except (OAuthError, HTTPError, ValueError) as error:
        request.session.clear()
        raise HTTPException(503, "구글 로그인에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.") from error
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    if not settings.google_enabled:
        raise HTTPException(503, "구글 로그인 설정을 준비 중입니다.")
    try:
        # Authlib가 state, PKCE와 ID 토큰의 서명, issuer, audience, 만료, nonce를 검증한다.
        token = await oauth.google.authorize_access_token(request)
        claims = token.get("userinfo")
        if not token.get("id_token") or not claims:
            raise ValueError("ID token missing")
        user = google_user(db, claims, request.session.get("consent_version"))
    except (OAuthError, JoseError, HTTPError, ValueError, HTTPException):
        request.session.clear()
        response = RedirectResponse(f"{settings.frontend_url.rstrip('/')}?authError=google", status_code=303)
        response.headers["Cache-Control"] = "no-store"
        return response
    request.session.clear()
    response = RedirectResponse(settings.frontend_url, status_code=303)
    create_login_session(db, user, response, request.cookies.get(SESSION_COOKIE))
    return response


@router.post("/logout", status_code=204)
def logout(request: Request, db: Session = Depends(get_db),
           _: None = Depends(require_origin)) -> Response:
    token = request.cookies.get(SESSION_COOKIE)
    session = db.get(LoginSession, token_hash(token)) if token else None
    if session:
        db.delete(session)
    db.commit()
    request.session.clear()
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, path="/", secure=settings.cookie_secure,
                           httponly=True, samesite="lax")
    response.headers["Cache-Control"] = "no-store"
    return response
