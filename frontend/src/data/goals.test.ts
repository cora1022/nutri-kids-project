import { describe, expect, it } from 'vitest';

import type { Profile } from '../types';
import { getDailyGoals, getMealGoals } from './goals';

describe('영양 목표 계산', () => {
  it('남자 청소년의 신체 정보로 EER와 영양 기준을 계산한다', () => {
    const profile: Profile = {
      gender: 'male',
      age: 14,
      height: 165,
      weight: 55,
      mealsPerDay: 3,
    };

    const daily = getDailyGoals(profile);
    const meal = getMealGoals(daily, profile.mealsPerDay);

    expect(daily.kcal).toBeCloseTo(2589.9485, 4);
    expect(daily.carbohydrate).toBeCloseTo(372.3051, 4);
    expect(daily.protein).toBe(60);
    expect(daily.calcium).toBe(950);
    expect(daily.vitaminA).toBe(750);
    expect(daily.vitaminC).toBe(90);
    expect(daily.vitaminD).toBe(10);
    expect(daily.iron).toBeNull();
    expect(daily.sodium).toBeNull();
    expect(meal.kcal).toBeCloseTo(863.3162, 4);
    expect(meal.iron).toBeNull();
  });

  it('여자 청소년 기준표와 EER 공식을 적용한다', () => {
    const daily = getDailyGoals({
      gender: 'female',
      age: 16,
      height: 160,
      weight: 50,
      mealsPerDay: 3,
    });

    expect(daily.kcal).toBeCloseTo(1981.004, 3);
    expect(daily.carbohydrate).toBeCloseTo(284.769325, 5);
    expect(daily.protein).toBe(55);
    expect(daily.calcium).toBe(700);
    expect(daily.vitaminA).toBe(650);
    expect(daily.vitaminC).toBe(100);
    expect(daily.vitaminD).toBe(10);
  });

  it('지원 연령 밖의 값은 계산하지 않는다', () => {
    expect(() =>
      getDailyGoals({
        gender: 'male',
        age: 5,
        height: 110,
        weight: 20,
        mealsPerDay: 3,
      }),
    ).toThrow('만 6세부터 18세');
  });
});
