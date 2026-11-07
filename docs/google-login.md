# 구글 로그인과 회원 식사 기록

React의 시작 화면에서 정보 이용에 동의하고 구글 로그인을 선택합니다. FastAPI가 구글 계정을 검증해 MySQL 회원과 연결하고, HttpOnly 세션 쿠키로 로그인 상태를 유지합니다. 처음 가입한 회원은 닉네임과 신체 정보를 저장한 뒤 식사를 기록합니다.

구글 OAuth 클라이언트 설정이 없으면 `GET /api/v1/auth/config`의 `googleEnabled`가 `false`입니다. 이때 로그인 기능은 숨기고 기존 브라우저 체험을 제공합니다. 체험 데이터는 회원의 서버 기록으로 자동 합치지 않습니다.

## Google Cloud 설정

1. [Google Cloud 인증 클라이언트](https://console.cloud.google.com/auth/clients)에서 프로젝트를 선택하거나 만듭니다.
2. Google Auth Platform의 Branding과 Audience에서 앱 이름, 지원 이메일과 이용 대상을 설정합니다. 테스트 상태라면 로그인에 사용할 이메일을 테스트 사용자로 등록합니다.
3. 클라이언트 만들기에서 **웹 애플리케이션**을 선택합니다.
4. 승인된 리디렉션 URI에 사용할 주소를 정확히 등록합니다.

```text
운영: https://nutri.cora1022.com/api/v1/auth/google/callback
개발: http://localhost:5173/api/v1/auth/google/callback
```

발급받을 값은 OAuth 클라이언트 ID와 클라이언트 보안 비밀번호입니다. 일반 API 키를 넣는 방식이 아닙니다. 리디렉션 주소는 Google Cloud 등록값과 서버 설정값이 일치해야 합니다. [Google 공식 OpenID Connect 문서](https://developers.google.com/identity/openid-connect/openid-connect)를 기준으로 구현했습니다.

## 로컬 설정

백엔드만 직접 실행한다면 `backend/.env.example`을 `backend/.env`로 복사하고 다음 값을 채웁니다. 설정 파일은 Git에 올리지 않습니다.

```dotenv
GOOGLE_CLIENT_ID=발급받은_클라이언트_ID
GOOGLE_CLIENT_SECRET=발급받은_클라이언트_보안_비밀번호
OAUTH_SESSION_SECRET=무작위로_생성한_긴_문자열
FRONTEND_URL=http://localhost:5173
GOOGLE_REDIRECT_URI=http://localhost:5173/api/v1/auth/google/callback
COOKIE_SECURE=false
```

세션 서명키는 다음 명령으로 생성할 수 있습니다. 실행한 값은 로컬 환경 파일에만 저장합니다.

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

로컬 Docker Compose에서는 루트 `.env`에 세 가지 인증 설정을 넣고 `docker compose up --build`를 실행합니다. 브라우저는 `http://localhost:5173`으로 접속해야 합니다. Vite가 콜백과 API 요청을 FastAPI로 전달합니다.

## VPS 설정과 배포

운영 서버 `/opt/nutri-kids/.env.production`의 기존 MySQL 설정을 유지하면서 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_SESSION_SECRET`를 추가합니다. 운영 Compose는 HTTPS 주소와 Secure 쿠키를 적용합니다. `SESSION_DAYS`의 기본값은 7일입니다.

기존 운영 코드를 교체하기 전에 소스, 환경 파일과 MySQL을 백업합니다. 이번 회원 기능의 테이블 변경은 `google_accounts`와 `login_sessions` 추가뿐입니다. 기존 `users`, `profiles`, `meals`, `meal_items`는 그대로 사용하며 `AUTO_CREATE_TABLES=true`일 때 새 테이블이 생성됩니다.

데이터 파일을 재적재할 필요가 없는 회원 기능 배포는 다음과 같이 진행할 수 있습니다. 이 명령은 새 코드를 서버에 반영한 뒤 실행합니다.

```bash
cd /opt/nutri-kids
docker compose --env-file .env.production -f docker-compose.prod.yml build api frontend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps api frontend
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

원천 데이터를 다시 적재할 때는 상품 ID를 유지해 갱신합니다. 원본에서 빠진 상품은 검색에서 숨기고 저장된 식사가 참조하는 행은 남깁니다. 기존 식사의 상품명과 분석 결과는 확정 시점 스냅샷이므로 이후 상품 변경에 따라 달라지지 않습니다.

## 저장 구조와 확인 방법

- `users`: 내부 회원 ID, 이메일과 닉네임. 구글 비밀번호는 받거나 저장하지 않습니다.
- `google_accounts`: Google `sub`와 내부 회원 ID, 가입 동의 버전과 시각. 이메일만 같다는 이유로 다른 계정을 자동 연결하지 않습니다.
- `login_sessions`: 무작위 세션 토큰의 SHA-256 해시와 만료 시각. 원본 토큰은 HttpOnly 쿠키로만 전달합니다.
- `profiles`: 회원의 신체 정보와 하루 식사 횟수.
- `meals`, `meal_items`: 회원별 확정 식사와 당시 분석 스냅샷.

배포 후 실제 Google 계정으로 로그인해 프로필을 저장하고 식사를 확정합니다. 새로고침이나 재로그인 후 **내 기록**에서 같은 결과가 보이는지 확인합니다. 다른 계정으로 로그인하면 앞 계정의 기록은 표시되지 않아야 합니다.

자동 테스트는 가짜 Google HTTP 응답을 사용하면서 Authlib의 state, PKCE, nonce와 RSA 토큰 서명 검증을 실제로 실행합니다. 실제 Google Cloud 프로젝트의 동의 화면과 운영 계정 로그인은 클라이언트 설정 이후 별도로 확인해야 합니다.
