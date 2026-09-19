# 영양 분석 로직

이 폴더는 `POST /api/v1/meals/analyze`의 JSON 계약과 영양 계산 구현을 분리하기 위한 경계다.

`engine.py`는 프로필 기반 목표 계산, 섭취량 환산, 영양 상태 판정과 보완 상품 추천을 수행한다. 계산 근거, 서비스 정책과 예시는 [Algorithm.md](Algorithm.md)에서 확인한다.

## 유지해야 하는 계약

- 요청 형식: `backend/app/schemas/meal.py`의 `MealAnalyzeRequest`
- 응답 형식: `backend/app/schemas/meal.py`의 `MealAnalysisResponse`
- 공개 함수: `analyze_meal(request, db)`
- API 경로: `POST /api/v1/meals/analyze`
- JSON 필드명: camelCase

스키마를 변경할 때는 프론트의 `frontend/src/services/mealApi.ts`와 `frontend/src/types.ts`를 함께 확인한다. `analyze_meal(request, db)` 공개 함수와 위 JSON 계약은 유지해야 한다.
