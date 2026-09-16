# 프론트와 백엔드 API 계약

기준 prefix는 `/api/v1`이며 JSON 필드명은 camelCase를 사용합니다. 날짜는 `YYYY-MM-DD`, 일시는 ISO 8601 형식으로 전달합니다. 확인할 수 없는 영양성분은 `0`이 아닌 `null`로 반환합니다.

## 역할 경계

- 프론트는 프로필, 선택한 상품, 섭취량을 전달하고 결과를 표시합니다.
- 백엔드는 목표량, 단위 환산, 영양소 합산, 상태 판정, 추천을 계산합니다.
- MySQL은 원천 데이터, 매핑 결과, 사용자와 식사 스냅샷을 저장합니다.
- 작성 중인 식사 초안은 브라우저 localStorage에 유지합니다.

## 공통 영양소

초기 화면은 `kcal`, `protein`, `calcium`, `iron`, `vitaminA`, `vitaminC`, `sodium`을 사용합니다.

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
| 회원가입 | `POST /api/v1/auth/signup` | 계약만 구성 |
| 로그인 | `POST /api/v1/auth/login` | 계약만 구성 |
| 내 프로필 | `GET /api/v1/users/me` | 계약만 구성 |
| 프로필 저장 | `PUT /api/v1/users/me/profile` | 계약만 구성 |
| 상품 검색 | `GET /api/v1/foods` | 구현 |
| 바코드 조회 | `GET /api/v1/foods/barcode/{barcode}` | 구현 |
| 상품 상세 | `GET /api/v1/foods/{foodId}` | 구현 |
| 한 끼 분석 | `POST /api/v1/meals/analyze` | 구현 |
| 식사 저장 | `POST /api/v1/meals` | 계약만 구성 |
| 하루 평가 | `GET /api/v1/meals/daily/{date}` | 계약만 구성 |

구체적인 요청과 응답 스키마는 서버 실행 후 `/docs`에서 확인합니다. FastAPI 스키마가 프론트 타입 정의의 기준입니다.

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
      "overallQuality": "MIXED",
      "standardFoodMatch": null
    }
  ],
  "page": 1,
  "size": 20,
  "total": 1,
  "hasNext": false
}
```

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

목표 영양소는 85% 미만을 `LOW`, 130% 초과를 `HIGH`로 판정합니다. 나트륨은 상한을 넘을 때만 `HIGH`입니다. 선택한 상품 중 하나라도 해당 성분이 없으면 확인된 합계만 반환하고 상태는 `UNKNOWN`으로 둡니다.

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
