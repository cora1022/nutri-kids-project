# 든든 (nutri-kids) — 프론트엔드

결식아동 대상 편의점 영양 체크 서비스의 React 프론트엔드입니다.
팀 플로우차트(01 가입·목표 설정 / 02 상품 검색·음식 입력 / 03 한 끼 평가·추천·하루 평가)의
분기 로직을 그대로 구현했습니다.

## 실행 방법
```bash
npm install
npm run dev
```

## ⚠️ 백엔드 연동 전 꼭 확인해 주세요

1. **`src/data/foods.js`** — 지금은 예시(placeholder) 상품 24개만 들어있습니다.
   실제 편의점 상품 DB / 일반 식품 영양성분 DB로 교체해야 합니다.
   → 실제 연동은 `src/services/foodApi.js`의 `searchFoods`, `findByBarcode`, `getFood`
   함수만 백엔드 fetch 호출로 바꾸면 되도록 분리해뒀습니다. UI 컴포넌트는 건드릴 필요 없어요.

2. **`src/data/goals.js`** — 연령·성별별 하루 영양 목표는 한국인 영양소 섭취기준(KDRIs)을
   단순화한 **간이 참고값**입니다. 실제 서비스에 쓰기 전에 영양 전공 팀원이
   공식 수치로 반드시 검증·교체해 주세요. (아동 건강과 직결되는 값이라 특히 중요합니다)

3. **`src/utils/storage.js`** — 지금은 localStorage로 동작합니다.
   `saveConfirmedMeal`, `loadMealsByDate` 등의 함수 내부만 실제 API 호출로 바꾸면
   나머지 코드는 그대로 동작하도록 설계했습니다.

## 폴더 구조
```
src/
  components/
    Onboarding/   01 가입·목표 설정 화면들
    FoodLog/      02 상품 검색·음식 입력 화면
    Evaluation/   03 한 끼 평가·추천, 하루 평가 화면
    common/       버튼, 카드, 영양소 막대 등 공용 UI
  context/        전역 상태 (프로필, 목표, 진행 단계, 식사 스택)
  data/           예시 식품 DB, 영양 목표 참고표
  services/       식품 검색 API (지금은 mock, 나중에 실 API로 교체)
  utils/          영양소 합산/판정/추천 로직, 로컬 저장소
```
