# 든든 정적 배포본

서버 비용 없이 운영하기 위해 `frontend/`와 같은 화면을 정적 파일만으로 동작하도록 옮긴 버전입니다. GitHub Pages로 배포합니다.

## 서버 버전과 다른 점

- 상품 검색은 `public/data/foods.json`에 내보낸 상품 목록에서 찾습니다. 검색 조건과 정렬은 서버와 같습니다.
- 한 끼 분석은 `src/services/nutritionEngine.ts`가 브라우저에서 계산합니다. `backend/app/services/nutrition/engine.py`를 그대로 옮겼고, 운영 API 응답과 같은 값이 나오는지 테스트로 확인합니다.
- 구글 로그인 버튼은 화면에 남아 있지만 누르면 지원하지 않는다는 안내만 보여 줍니다. 모든 이용자는 게스트로 이용하고 기록은 브라우저에 저장됩니다.

## 실행 방법

```bash
cd static-nutri
npm install
npm run dev
```

## 상품 데이터 갱신

운영 API가 살아 있을 때 다음 명령으로 상품 목록을 다시 내려받습니다. 다른 주소의 API를 쓰려면 주소를 인자로 넘깁니다.

```bash
cd static-nutri
npm run export:foods
```

## 검증과 배포

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`main`에 `static-nutri/` 변경이 올라가면 `.github/workflows/deploy-static.yml`이 같은 검사를 실행하고 GitHub Pages에 배포합니다. 빌드는 상대 경로를 쓰므로 하위 경로나 사용자 도메인에서 그대로 동작합니다.
