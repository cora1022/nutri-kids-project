"""구글 신원과 서버 세션을 내부 회원 ID에 연결한다."""
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import secrets

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import GoogleAccount, LoginSession, User
from app.schemas.auth import AuthUser

SESSION_COOKIE = "nutrikids_session"
CONSENT_VERSION = "2026-10-28"


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def token_hash(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def auth_user(user: User) -> AuthUser:
    return AuthUser(id=user.id, email=user.email, nickname=user.nickname,
                    profile_completed=user.profile is not None)


def require_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    session = db.get(LoginSession, token_hash(token)) if token else None
    if session is None or session.expires_at <= utc_now():
        raise HTTPException(401, "로그인이 필요합니다. 다시 로그인해 주세요.")
    user = db.get(User, session.user_id)
    if user is None:
        raise HTTPException(401, "회원 정보를 찾을 수 없습니다.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        require_origin(request)
    return user


def require_origin(request: Request) -> None:
    allowed = {*settings.cors_origin_list, settings.frontend_url.rstrip("/")}
    if request.headers.get("origin") not in allowed:
        raise HTTPException(403, "허용되지 않은 요청 출처입니다.")


def create_login_session(db: Session, user: User, response: Response,
                         old_token: str | None = None) -> None:
    if old_token:
        db.execute(delete(LoginSession).where(LoginSession.token_hash == token_hash(old_token)))
    db.execute(delete(LoginSession).where(LoginSession.expires_at <= utc_now()))
    token = secrets.token_urlsafe(32)
    seconds = settings.session_days * 86400
    db.add(LoginSession(token_hash=token_hash(token), user_id=user.id,
                        expires_at=utc_now() + timedelta(seconds=seconds)))
    db.commit()
    response.set_cookie(SESSION_COOKIE, token, max_age=seconds, httponly=True,
                        secure=settings.cookie_secure, samesite="lax", path="/")
    response.headers["Cache-Control"] = "no-store"


def google_user(db: Session, claims: dict, consent_version: str | None) -> User:
    subject = claims.get("sub")
    email = claims.get("email")
    if not isinstance(subject, str) or not subject or len(subject) > 255:
        raise HTTPException(401, "구글 계정을 확인하지 못했습니다.")
    if claims.get("email_verified") is not True or not isinstance(email, str) or len(email) > 255:
        raise HTTPException(401, "구글에서 확인한 이메일이 필요합니다.")
    account = db.get(GoogleAccount, subject)
    if account:
        return db.get(User, account.user_id)
    if consent_version != CONSENT_VERSION:
        raise HTTPException(403, "가입 전 개인정보 수집과 이용에 동의해 주세요.")
    if db.scalar(select(User).where(User.email == email)):
        # 이메일 일치만으로 기존 계정을 다른 로그인 수단에 자동 연결하지 않는다.
        raise HTTPException(409, "이미 등록된 이메일입니다. 기존 계정 연결이 필요합니다.")
    nickname = str(claims.get("name") or email.split("@")[0])[:40]
    user = User(email=email, nickname=nickname, password_hash="!google-only")
    db.add(user)
    try:
        db.flush()
        db.add(GoogleAccount(subject=subject, user_id=user.id, consent_version=consent_version))
        db.commit()
    except IntegrityError as error:
        db.rollback()
        # 같은 계정의 동시 콜백은 이미 생성된 회원으로 처리한다.
        account = db.get(GoogleAccount, subject)
        if account:
            return db.get(User, account.user_id)
        raise HTTPException(409, "회원 정보가 변경되었습니다. 다시 로그인해 주세요.") from error
    return user
