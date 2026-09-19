"""기존 REST API에서 사용하는 영양 분석 서비스의 공개 진입점.

계산 구현은 engine.py, 근거와 사용 예시는 Algorithm.md에 있다.
"""

from app.services.nutrition.engine import analyze_meal

__all__ = ["analyze_meal"]
