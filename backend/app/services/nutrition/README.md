# 영양 분석 로직 인수인계

이 폴더는 `POST /api/v1/meals/analyze`의 JSON 계약과 영양 계산 구현을 분리하기 위한 경계다.

현재 `engine.py`는 요청 상품의 존재 여부만 확인한다. 응답은 기존 `MealAnalysisResponse` 형식을 유지하지만 모든 영양소를 `UNKNOWN`과 `MISSING`으로 반환한다. 추천 결과는 비어 있으며 `NUTRITION_ENGINE_PENDING` 경고를 포함한다.

## 유지해야 하는 계약

- 요청 형식: `backend/app/schemas/meal.py`의 `MealAnalyzeRequest`
- 응답 형식: `backend/app/schemas/meal.py`의 `MealAnalysisResponse`
- 공개 함수: `analyze_meal(request, db)`
- API 경로: `POST /api/v1/meals/analyze`
- JSON 필드명: camelCase

스키마 변경이 필요한 경우 프론트 담당자와 먼저 합의한다. 폴더 구조, 내부 자료형, 계산 단계와 파일 분리는 담당자가 자유롭게 설계한다.

`engine.py`는 API 연결을 유지하기 위한 임시 파일이다. 구현 과정에서 이름을 바꾸거나 다른 구조로 교체해도 되지만 `analyze_meal(request, db)` 공개 함수와 위 JSON 계약은 유지해야 한다.
