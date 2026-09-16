# 든든 (nutri-kids)

결식아동 대상 편의점 영양 체크 서비스입니다. 기존 React 화면 구성을 유지하면서 FastAPI와 MySQL을 연결할 수 있도록 프로젝트 골격과 JSON 계약을 추가했습니다.

## 실행 방법

Docker Desktop이 실행 중이면 다음 명령으로 프론트, API, MySQL을 함께 시작합니다.

```bash
docker compose up --build
```

- 프론트: http://localhost:5173
- API 문서: http://localhost:8000/docs
- 상태 확인: http://localhost:8000/api/v1/health

각 영역을 따로 실행할 수도 있습니다.

```bash
npm install
npm run dev
```

```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn app.main:app --reload
```

환경 변수를 지정하지 않으면 백엔드는 개발용 SQLite를 사용합니다. MySQL 연결 문자열은 `.env.example`에서 확인할 수 있습니다.

## 테스트 데이터 적재

식약처 인증키는 `backend/.env`의 `MFDS_SERVICE_KEY`에 저장하고 저장소에는 올리지 않습니다. 다음 명령은 CU 원본에서 상품 5개를 골라 검색용 DB를 만들고, 국가표준식품성분표 10.4와 식약처 API 결과를 연결합니다.

```powershell
cd backend
.venv\Scripts\python.exe scripts\import_data.py `
  --cu "C:\Users\70sou\Desktop\CU_식품음료_상품목록.xlsx" `
  --standard "C:\Users\70sou\Downloads\식품성분표(10개정판).xlsx"
```

적재 결과는 식약처 확인값, 국가표준 추정값, 미확인값을 구분합니다. 미확인 성분은 0으로 바꾸지 않으며 한 끼 판정을 보류합니다.

## 구현 현황

1. 기존 화면 흐름과 컴포넌트는 프론트 기준 UI로 유지했습니다.
2. `src/services/foodApi.js`는 `/api/v1/foods` 계약을 호출합니다.
3. FastAPI의 상품 검색, 바코드 조회, 상품 상세 조회는 DB 데이터가 들어오면 바로 동작합니다.
4. 프로필 기반 목표 계산, 단위 환산, 영양소 판정, CU 상품 추천을 `/api/v1/meals/analyze`에 구현했습니다.
5. 회원가입, 로그인, 프로필 저장, 식사 저장과 하루 평가는 아직 계약만 구성되어 있습니다.

## 폴더 구조

```text
src/                         React 프론트
  components/                화면과 공용 UI
  context/                   전역 상태
  services/                  백엔드 API 호출
  utils/                     기존 임시 계산과 로컬 저장
backend/
  app/
    routers/                 API 엔드포인트
    schemas/                 프론트와 공유할 JSON 계약
    services/                영양 계산과 추천 로직 경계
    models.py                MySQL 테이블 모델
  scripts/                   원천 데이터 적재 진입점
  tests/                     API 계약 테스트
docs/
  api-contract.md            프론트와 백엔드 계약 문서
docker-compose.yml           프론트, API, MySQL 개발 환경
```

## 검증

```bash
npm run lint
npm run build
```

```powershell
cd backend
.venv\Scripts\pytest -q
```

API 계약의 기준은 [docs/api-contract.md](docs/api-contract.md)와 실행 중인 FastAPI `/docs`입니다.
