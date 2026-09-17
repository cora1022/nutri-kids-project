import re
import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True)
class StandardFoodRule:
    food_code: str
    keywords: tuple[str, ...]
    categories: tuple[str, ...] = ()
    confidence: float = 0.82


@dataclass(frozen=True)
class ServingEstimate:
    amount: float
    unit: str
    label: str
    from_product_name: bool


ALIASES = {
    "요거트": "요구르트",
    "돈까스": "돈가스",
    "오뎅": "어묵",
    "도너츠": "도넛",
    "핫바": "어육소시지",
    "맥스봉": "어육소시지",
    "스파게티": "파스타",
    "삼각김밥": "삼각밥",
}

SIZE_PATTERN = re.compile(r"(\d+(?:\.\d+)?)\s*(kg|ml|g|l)(?![a-z])", re.IGNORECASE)


def normalize_product_name(name: str) -> str:
    value = unicodedata.normalize("NFKC", name).lower().strip()
    if ")" in value:
        value = value.split(")", 1)[1]
    value = SIZE_PATTERN.sub(" ", value)
    value = re.sub(r"\d+\s*[x×]\s*\d+", " ", value)
    value = re.sub(r"[^0-9a-z가-힣]+", "", value)
    for source, target in ALIASES.items():
        value = value.replace(source, target)
    return value


def estimate_serving(name: str, category: str | None) -> ServingEstimate:
    matches = list(SIZE_PATTERN.finditer(unicodedata.normalize("NFKC", name)))
    if matches:
        amount = float(matches[-1].group(1))
        unit = matches[-1].group(2).lower()
        if unit == "kg":
            amount, unit = amount * 1000, "g"
        elif unit == "l":
            amount, unit = amount * 1000, "ml"
        shown = int(amount) if amount.is_integer() else amount
        return ServingEstimate(amount, unit, f"{shown}{unit} 상품 기준 추정", True)

    unit = "ml" if category == "음료" else "g"
    return ServingEstimate(100, unit, f"100{unit} 표준 기준 추정", False)


# 국가표준식품성분표 10.4의 대표 식품코드다. 구체적인 규칙을 먼저 두고
# 넓은 분류 기본값을 마지막에 적용한다.
RULES = (
    StandardFoodRule("3421", ("얼음", "생수", "워터"), ("음료",), 0.95),
    StandardFoodRule("2982", ("토닉워터",), ("음료",), 0.95),
    StandardFoodRule("2978", ("콜라",), ("음료",), 0.93),
    StandardFoodRule("2972", ("사이다", "소다", "에이드"), ("음료",), 0.88),
    StandardFoodRule("1546", ("오렌지",), ("음료",), 0.9),
    StandardFoodRule("1624", ("포도", "청포도"), ("음료",), 0.88),
    StandardFoodRule("1518", ("사과",), ("음료",), 0.88),
    StandardFoodRule("1518", ("주스", "쥬스", "쥬시쿨", "쿨피스", "피크닉", "과수원"), ("음료",), 0.66),
    StandardFoodRule("571", ("두유",), (), 0.93),
    StandardFoodRule("3612", ("아몬드브리즈", "아몬드음료"), ("음료",), 0.91),
    StandardFoodRule("2847", ("딸기우유",), ("음료",), 0.93),
    StandardFoodRule("2848", ("바나나우유",), ("음료",), 0.93),
    StandardFoodRule("2849", ("초코우유", "초콜릿우유", "초코", "초콜릿"), ("음료",), 0.86),
    StandardFoodRule("2850", ("커피우유",), ("음료",), 0.93),
    StandardFoodRule("2846", ("우유",), ("음료",), 0.86),
    StandardFoodRule("2835", ("요구르트", "요구르트"), ("음료", "식품"), 0.9),
    StandardFoodRule("2942", ("커피", "라떼", "모카", "콜드브루", "마끼아또", "아메리카노"), ("음료",), 0.82),
    StandardFoodRule("2958", ("아이스티", "복숭아차"), ("음료", "즉석조리"), 0.84),
    StandardFoodRule("2912", ("녹차",), ("음료",), 0.9),
    StandardFoodRule("2921", ("보리차", "옥수수수염차", "누룽지차", "하늘보리"), ("음료",), 0.84),
    StandardFoodRule("2927", ("쌍화",), ("음료",), 0.82),
    StandardFoodRule("2955", ("홍차", "밀크티"), ("음료",), 0.86),
    StandardFoodRule("2830", ("아이스크림", "월드콘", "돼지바", "수박바", "캔디바", "뽕따"), ("아이스크림",), 0.78),
    StandardFoodRule("2172", ("참치샐러드",), ("간편식사",), 0.9),
    StandardFoodRule("1105", ("샐러드",), ("간편식사",), 0.72),
    StandardFoodRule("3179", ("샌드", "샌드위치"), ("간편식사", "즉석조리", "과자류"), 0.82),
    StandardFoodRule("3236", ("버거", "햄버거"), ("간편식사",), 0.88),
    StandardFoodRule("3380", ("피자",), (), 0.86),
    StandardFoodRule("3234", ("핫도그",), (), 0.9),
    StandardFoodRule("3165", ("볶음밥",), (), 0.88),
    StandardFoodRule("3188", ("파스타",), (), 0.86),
    StandardFoodRule("3096", ("카레",), (), 0.91),
    StandardFoodRule("3087", ("짜장",), (), 0.9),
    StandardFoodRule("3158", ("김치만두",), (), 0.92),
    StandardFoodRule("3156", ("만두",), (), 0.86),
    StandardFoodRule("3142", ("라면", "사발면", "탕면", "짬뽕", "짜파게티", "볶음면", "비빔면", "우동"), (), 0.84),
    StandardFoodRule("73", ("죽",), (), 0.84),
    StandardFoodRule("146", ("떡볶이", "가래떡"), (), 0.8),
    StandardFoodRule("152", ("백설기",), (), 0.92),
    StandardFoodRule("412", ("인절미",), (), 0.9),
    StandardFoodRule("146", ("떡",), (), 0.72),
    StandardFoodRule("1650", ("닭가슴살",), (), 0.93),
    StandardFoodRule("1651", ("치킨", "닭다리", "닭강정"), (), 0.8),
    StandardFoodRule("1700", ("돈가스",), (), 0.74),
    StandardFoodRule("1746", ("족발", "편육"), (), 0.84),
    StandardFoodRule("2407", ("어육소시지",), (), 0.9),
    StandardFoodRule("1756", ("소시지",), (), 0.87),
    StandardFoodRule("1760", ("스팸", "통조림햄"), (), 0.9),
    StandardFoodRule("1765", ("햄",), ("식품",), 0.8),
    StandardFoodRule("2401", ("어묵",), (), 0.9),
    StandardFoodRule("3217", ("유부초밥",), (), 0.9),
    StandardFoodRule("2166", ("참치",), ("식품",), 0.86),
    StandardFoodRule("2896", ("대두유", "콩기름", "카놀라유"), ("식품",), 0.7),
    StandardFoodRule("1214", ("콩나물",), ("식품",), 0.94),
    StandardFoodRule("900", ("단무지",), ("식품",), 0.94),
    StandardFoodRule("2738", ("오징어", "숏다리", "쥐포"), ("식품",), 0.72),
    StandardFoodRule("3163", ("미트볼",), ("식품",), 0.92),
    StandardFoodRule("3102", ("케첩", "케챂"), ("식품",), 0.94),
    StandardFoodRule("3069", ("사과식초",), ("식품",), 0.95),
    StandardFoodRule("3189", ("스프",), ("식품",), 0.84),
    StandardFoodRule("2662", ("게맛살", "크래미", "크랩킹"), ("식품",), 0.84),
    StandardFoodRule("62", ("김밥", "삼각밥", "도시락", "컵밥", "컵반", "햇반", "덮밥", "비빔밥"), ("간편식사", "식품"), 0.68),
    StandardFoodRule("532", ("초콜릿", "초코바", "가나초코", "드림카카오"), ("과자류",), 0.87),
    StandardFoodRule("198", ("초코칩쿠키", "초코쿠키"), ("과자류",), 0.9),
    StandardFoodRule("197", ("쿠키",), ("과자류",), 0.84),
    StandardFoodRule("200", ("크래커",), ("과자류",), 0.88),
    StandardFoodRule("536", ("카라멜",), ("과자류",), 0.9),
    StandardFoodRule("3287", ("마이쮸", "캔디", "사탕"), ("과자류",), 0.88),
    StandardFoodRule("519", ("젤리",), ("과자류",), 0.88),
    StandardFoodRule("493", ("껌",), ("과자류",), 0.91),
    StandardFoodRule("516", ("양갱",), ("과자류",), 0.95),
    StandardFoodRule("363", ("카라멜팝콘",), ("과자류",), 0.92),
    StandardFoodRule("362", ("팝콘",), ("과자류",), 0.88),
    StandardFoodRule("438", ("감자칩", "포카칩", "프링글스", "허니버터칩"), ("과자류",), 0.9),
    StandardFoodRule("189", ("새우깡", "새우칩", "알새우칩"), ("과자류",), 0.88),
    StandardFoodRule("190", ("콘칩", "카라멜콘", "꼬깔콘", "옥수수스낵"), ("과자류",), 0.86),
    StandardFoodRule("405", ("유과",), ("과자류",), 0.92),
    StandardFoodRule("232", ("도넛",), ("과자류", "즉석조리"), 0.86),
    StandardFoodRule("262", ("크림빵",), ("과자류", "즉석조리"), 0.88),
    StandardFoodRule("257", ("카스텔라",), ("과자류",), 0.9),
    StandardFoodRule("277", ("치즈케이크",), ("과자류",), 0.9),
    StandardFoodRule("276", ("초코케이크", "초콜릿케이크"), ("과자류",), 0.9),
    StandardFoodRule("274", ("케이크", "마카롱"), ("과자류",), 0.7),
    StandardFoodRule("265", ("페이스트리",), ("과자류", "즉석조리"), 0.86),
    StandardFoodRule("241", ("바게트",), ("과자류", "즉석조리"), 0.88),
    StandardFoodRule("246", ("식빵",), ("과자류", "즉석조리"), 0.88),
    StandardFoodRule("229", ("소보로",), ("과자류", "즉석조리"), 0.83),
    StandardFoodRule("248", ("빵",), ("과자류", "즉석조리"), 0.62),
    StandardFoodRule("314", ("그래놀라",), ("과자류", "식품"), 0.9),
    StandardFoodRule("313", ("시리얼",), ("과자류", "식품"), 0.85),
    StandardFoodRule("664", ("아몬드",), ("과자류", "식품"), 0.84),
    StandardFoodRule("644", ("맛밤", "군밤", "밤"), ("과자류", "식품"), 0.82),
    StandardFoodRule("452", ("고구마",), ("과자류", "식품"), 0.75),
    StandardFoodRule("185", ("과자", "스낵"), ("과자류",), 0.58),
)


CATEGORY_DEFAULTS = {
    "과자류": StandardFoodRule("185", ("",), ("과자류",), 0.5),
    "아이스크림": StandardFoodRule("2830", ("",), ("아이스크림",), 0.55),
    "간편식사": StandardFoodRule("62", ("",), ("간편식사",), 0.46),
}


def match_standard_food(name: str, category: str | None) -> StandardFoodRule | None:
    normalized = normalize_product_name(name)
    for rule in RULES:
        if rule.categories and category not in rule.categories:
            continue
        if any(keyword in normalized for keyword in rule.keywords):
            return rule
    return CATEGORY_DEFAULTS.get(category or "")
