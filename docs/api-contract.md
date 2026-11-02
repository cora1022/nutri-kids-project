# 프론트와 백엔드 API 계약

기준 prefix는 `/api/v1`이며 JSON 필드명은 camelCase를 사용합니다. 날짜는 `YYYY-MM-DD`, 일시는 ISO 8601 형식으로 전달합니다. 확인할 수 없는 영양성분은 `0`이 아닌 `null`로 반환합니다.

## 역할 경계

- 프론트는 프로필, 선택한 상품, 섭취량을 전달하고 결과를 표시합니다.
- 백엔드는 목표량, 단위 환산, 영양소 합산, 상태 판정과 추천을 계산합니다.
- MySQL은 원천 데이터, 매핑 결과, 사용자와 식사 스냅샷을 저장합니다.
- 작성 중인 식사 초안은 브라우저 localStorage에 유지합니다.

## 공통 영양소

화면은 `kcal`, `protein`, `carbohydrate`, `calcium`, `iron`, `vitaminA`, `vitaminC`, `vitaminD`, `sodium`을 사용합니다.

```json
{
  "value": 190,
  "unit": "kcal",
  "quality": "CONFIRMED",
  "source": "MFDS"
}
```

`quality`은 `CONFIRMED`, `ESTIMATED`, `MIXED`, `MISSING` 중 하나입니다. `source`는 `MFDS`, `NATIONAL_STANDARD`, `MANUFACTURER`, `NONE` 중 하나입니다.

## 엔드포인트

| 기능 | 메서드와 경로 | 상태 |
| --- | --- | --- |
| 상태 확인 | `GET /api/v1/health` | 구현 |
| 로그인 설정 | `GET /api/v1/auth/config` | 구현 |
| 구글 가입과 로그인 시작 | `GET /api/v1/auth/google/login?consent=true` | OAuth 설정 필요 |
| 구글 콜백 | `GET /api/v1/auth/google/callback` | OAuth 설정 필요 |
| 로그아웃 | `POST /api/v1/auth/logout` | 구현 |
| 내 회원 정보와 프로필 | `GET /api/v1/users/me` | 구현, 로그인 필요 |
| 프로필 저장 | `PUT /api/v1/users/me/profile` | 구현, 로그인 필요 |
| 상품 검색 | `GET /api/v1/foods` | 구현 |
| 바코드 조회 | `GET /api/v1/foods/barcode/{barcode}` | 구현 |
| 상품 상세 | `GET /api/v1/foods/{foodId}` | 구현 |
| 한 끼 분석 | `POST /api/v1/meals/analyze` | 구현 |
| 식사 저장 | `POST /api/v1/meals` | 구현, 로그인 필요 |
| 식사 상세 | `GET /api/v1/meals/{mealId}` | 구현, 본인 기록만 조회 |
| 하루 평가 | `GET /api/v1/meals/daily/{date}` | 구현, 본인 기록만 조회 |

구체적인 요청과 응답 스키마는 서버 실행 후 `/docs`에서 확인합니다. FastAPI 스키마가 프론트 타입 정의의 기준입니다.

## 회원 인증과 프로필

구글 OAuth 콜백에서 가입 또는 로그인을 처리하고 `nutrikids_session` HttpOnly 쿠키를 발급합니다. 브라우저는 `credentials: 'include'`로 쿠키를 전달합니다. 토큰을 localStorage나 URL에 넣지 않습니다. 회원 정보를 변경하거나 식사를 저장할 때는 허용한 프론트 주소의 `Origin`이 필요합니다.

기존 미구현 `POST /auth/signup`, `POST /auth/login`은 구글 로그인 경로로 대체했습니다. 비밀번호 회원가입은 제공하지 않습니다.

`GET /users/me`와 `PUT /users/me/profile`은 `user`, `profile`, `goals`를 반환합니다. 첫 로그인 직후에는 `profile`과 `goals`가 `null`입니다. 프로필을 저장하면 `goals.daily`와 `goals.perMeal`에 서버가 계산한 목표가 채워집니다.

```json
{
  "user": {
    "id": "usr_example",
    "email": "member@example.com",
    "nickname": "든든친구",
    "profileCompleted": false
  },
  "profile": null,
  "goals": null
}
```

`PUT /users/me/profile` 요청은 `nickname`, `sex`, `age`, `heightCm`, `weightKg`, `mealsPerDay`를 받습니다. 철분과 나트륨은 평가 기준 범위 밖이므로 해당 목표의 `value`가 `null`입니다. OAuth 설정은 서버 환경 변수로 전달합니다.

## 상품 검색

요청:

```text
GET /api/v1/foods?query=삼각김밥&sourceType=CU_PRODUCT&page=1&size=20
```

응답:

```json
{
  "items": [
    {
      "id": "cu:100023",
      "sourceType": "CU_PRODUCT",
      "name": "참치마요 삼각김밥",
      "brand": "CU",
      "category": "간편식사",
      "price": 1300,
      "barcode": "8801234567890",
      "imageUrl": null,
      "itemReportNo": "202600123456",
      "itemReportCandidates": ["202600123456"],
      "itemReportStatus": "식약처 API 확인",
      "itemReportEvidence": "식약처 영양성분 API 제품명과 보고번호 확인",
      "serving": {
        "amount": 110,
        "unit": "g",
        "countUnit": "개",
        "label": "1개(110g)"
      },
      "nutrients": {
        "kcal": {
          "value": 190,
          "unit": "kcal",
          "quality": "CONFIRMED",
          "source": "MFDS"
        }
      },
      "overallQuality": "ESTIMATED",
      "standardFoodMatch": {
        "foodCode": "62",
        "name": "멥쌀, 백미, 밥",
        "matchMethod": "NORMALIZED_RULE",
        "confidence": 0.68
      }
    }
  ],
  "page": 1,
  "size": 20,
  "total": 1,
  "hasNext": false
}
```

`itemReportNo`는 식약처 API 확인 번호를 우선 사용합니다. API 확인값이 없고 엑셀 후보가 있으면 첫 번째 후보를 자동 확정 번호로 사용합니다. 전체 후보와 자동 확정 근거는 `itemReportCandidates`, `itemReportStatus`, `itemReportEvidence`에서 확인합니다. 번호 자동 확정은 영양성분 값의 확인 여부와 별개입니다.

상품 검색은 `itemReportNo`가 있는 상품만 반환합니다. 번호가 없는 CU 상품은 DB에는 보존하지만 검색 결과에서는 제외합니다.

국가표준식품성분표 연결값은 100g 기준값을 상품 제공량으로 환산하고 `ESTIMATED`와 `NATIONAL_STANDARD`로 표시합니다. 상품명에 용량이 없으면 100g 또는 100ml 기준을 사용합니다. 식약처 API에서 확인한 영양소가 있으면 해당 성분만 `CONFIRMED`와 `MFDS`로 우선 적용합니다.

## 한 끼 분석 요청

```json
{
  "mealType": "LUNCH",
  "eatenAt": "2026-09-16T12:30:00+09:00",
  "profile": {
    "sex": "MALE",
    "age": 10,
    "heightCm": 140,
    "weightKg": 38,
    "mealsPerDay": 3
  },
  "items": [
    {
      "foodId": "cu:100023",
      "quantity": 1,
      "quantityUnit": "SERVING"
    }
  ],
  "recommendationScope": "CU_ONLY"
}
```

`quantityUnit`은 `SERVING`, `GRAM`, `MILLILITER` 중 하나입니다. 식사를 저장할 때는 같은 본문에 중복 방지용 `clientRequestId`를 추가합니다.

영양 엔진은 서버 DB의 상품 성분과 전달받은 섭취량으로 계산합니다. 철분과 나트륨은 섭취량만 반환하고 판정은 `UNKNOWN`입니다. 계산 근거와 범위는 `backend/app/services/nutrition/Algorithm.md`에 있습니다.

## 식사 확정과 하루 결과

`POST /meals`에는 위 분석 요청에 `clientRequestId`를 추가합니다. 서버는 로그인한 회원의 저장된 프로필로 다시 분석하고, 상품명, 섭취량과 분석 결과를 스냅샷으로 저장합니다. 요청 본문의 `profile`은 계약을 유지하지만 저장 계산에는 DB 프로필을 사용합니다.

새 저장은 HTTP 201이며, 같은 회원의 동일한 `clientRequestId`와 식사 본문을 다시 보내면 기존 결과를 HTTP 200으로 반환합니다. 같은 ID에 다른 식사를 보내면 HTTP 409입니다. 재시도할 때 `eatenAt`을 새로 만들지 않습니다. 서로 다른 회원은 같은 요청 ID를 사용할 수 있습니다.

`eatenAt`은 시간대가 있는 ISO 8601 일시가 필요합니다. MySQL에는 UTC로 저장하며 `GET /meals/daily/2026-10-28`은 한국 시간 10월 28일 00:00부터 다음 날 00:00 전까지 조회합니다.

하루 결과는 `date`, `recordedMealCount`, `expectedMealCount`, `isPartial`, `meals`, `dailyAnalysis`를 반환합니다. `meals`에는 각 식사의 `id`, `clientRequestId`, `items`, `analysis`도 포함합니다. 하루 합계는 저장된 분석 스냅샷을 사용하고 현재 프로필의 하루 목표와 비교합니다. 일부 식사만 기록했거나 성분이 누락된 상태는 별도로 표시하며 미확인 성분을 0으로 바꾸지 않습니다.

## 오류 형식

```json
{
  "code": "VALIDATION_ERROR",
  "message": "입력값을 확인해 주세요.",
  "fieldErrors": [
    {
      "field": "items[0].quantity",
      "message": "섭취량은 0보다 커야 합니다."
    }
  ],
  "requestId": "req_01K5MNOP"
}
```
