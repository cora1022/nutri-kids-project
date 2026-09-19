from types import SimpleNamespace

import pytest

from app.services.nutrition.engine import Target, Value, assess, build_targets, calculate_eer


def test_calculate_eer_matches_frontend_reference_cases() -> None:
    male = calculate_eer("MALE", age=14, height_cm=165, weight_kg=55)
    female = calculate_eer("FEMALE", age=16, height_cm=160, weight_kg=50)

    assert male["daily_kcal"] == pytest.approx(2589.9485)
    assert female["daily_kcal"] == pytest.approx(1981.004)


def test_build_targets_uses_age_and_sex_reference_values() -> None:
    profile = SimpleNamespace(
        sex="MALE",
        age=14,
        height_cm=165,
        weight_kg=55,
        meals_per_day=3,
    )

    targets, trace = build_targets(profile)

    assert targets["protein"].daily == 60
    assert targets["calcium"].daily == 950
    assert targets["vitaminA"].daily == 750
    assert targets["vitaminC"].daily == 90
    assert targets["vitaminD"].daily == 10
    assert targets["carbohydrate"].daily == pytest.approx(372.305096875)
    assert targets["kcal"].per_meal == pytest.approx(863.316166667)
    assert trace["age_band"] == (12, 14)


def test_assessment_keeps_rni_and_ai_meanings_separate() -> None:
    rni = Target(daily=60, per_meal=20, kind="RNI")
    ai = Target(daily=10, per_meal=5, kind="AI")

    assert assess(Value(30, "CONFIRMED"), rni)[1] == "ADEQUATE"
    assert assess(Value(4, "CONFIRMED"), ai)[1] == "UNKNOWN"
    assert assess(Value(5, "CONFIRMED"), ai)[1] == "ADEQUATE"
