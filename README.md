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
cd frontend
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

식약처 인증키는 `backend/.env`의 `MFDS_SERVICE_KEY`에 저장하고 저장소에는 올리지 않습니다. 다음 명령은 2차 수정 CU 자료의 전체 상품을 검색용 DB에 넣고, 선택한 5개 상품에 국가표준식품성분표 10.4와 식약처 API 결과를 연결합니다.

```powershell
cd backend
.venv\Scripts\python.exe scripts\import_data.py `
  --cu "C:\Users\70sou\Documents\카카오톡 받은 파일\CU_식품음료_상품목록_2차수정.xlsx" `
  --standard "C:\Users\70sou\Downloads\식품성분표(10개정판).xlsx"
```

엑셀의 품목제조보고번호 후보가 있으면 첫 번째 후보를 `itemReportNo`로 자동 확정합니다. 전체 후보는 `itemReportCandidates`에 유지하고, 자동 확정 여부와 근거는 `itemReportStatus`, `itemReportEvidence`로 반환합니다. 상품 검색은 품목제조보고번호가 있는 상품만 반환합니다.

영양값은 국가표준식품성분표 10.4의 100g 기준값을 주 데이터로 사용합니다. 상품명 별칭과 CU 분류를 정규화해 대표 표준식품을 고르고, 상품명에서 판매 용량을 찾으면 해당 용량으로 환산합니다. 용량이 없으면 100g 또는 100ml 기준 추정값으로 표시합니다. 식약처 API에서 직접 확인된 영양소는 국가표준 추정값보다 우선합니다. 자동 연결 결과는 `standardFoodMatch`에 식품코드, 식품명, 연결 방식과 신뢰도로 반환합니다.

## 구현 현황

1. 기존 화면 흐름과 컴포넌트는 프론트 기준 UI로 유지했습니다.
2. `frontend/src/services/foodApi.js`는 `/api/v1/foods` 계약을 호출합니다.
3. FastAPI의 상품 검색, 바코드 조회, 상품 상세 조회는 DB 데이터가 들어오면 바로 동작합니다.
4. `/api/v1/meals/analyze`는 기존 JSON 계약을 유지하는 인수인계용 임시 엔진으로 구성했습니다. 실제 목표 계산, 영양소 판정과 추천 로직은 구현 예정입니다.
5. 회원가입, 로그인, 프로필 저장, 식사 저장과 하루 평가는 아직 계약만 구성되어 있습니다.

## 폴더 구조

```text
frontend/                    React 프론트
  public/                    정적 파일
  src/
    components/              화면과 공용 UI
    context/                 전역 상태
    services/                백엔드 API 호출
    utils/                   기존 임시 계산과 로컬 저장
backend/
  app/
    routers/                 API 엔드포인트
    schemas/                 프론트와 공유할 JSON 계약
    services/nutrition/      영양 계산 인수인계 경계와 임시 엔진
    models.py                MySQL 테이블 모델
  scripts/                   원천 데이터 적재 진입점
  tests/                     API 계약 테스트
docs/
  api-contract.md            프론트와 백엔드 계약 문서
  data-pipeline.md           원천 데이터 정규화와 영양값 생성 과정
docker-compose.yml           프론트, API, MySQL 개발 환경
```

## 검증

```bash
cd frontend
npm run lint
npm run build
```

```powershell
cd backend
.venv\Scripts\pytest -q
```

PR을 만들거나 `main`에 푸시하면 GitHub Actions가 같은 검사를 자동으로 실행합니다. 프론트는 JavaScript와 TypeScript 중복 파일 검사, ESLint, 선택적 TypeScript 검사와 빌드를 진행합니다. 백엔드는 SQLite 환경에서 전체 pytest를 실행하고, 개발용과 운영용 Docker Compose 설정도 함께 확인합니다.

API 계약의 기준은 [docs/api-contract.md](docs/api-contract.md)와 실행 중인 FastAPI `/docs`입니다. 원천 데이터가 검색과 영양 분석값으로 변환되는 과정은 [docs/data-pipeline.md](docs/data-pipeline.md)에서 확인합니다.
