"""영양 분석 서비스의 공개 진입점."""

from app.services.nutrition.engine import analyze_meal

__all__ = ["analyze_meal"]
