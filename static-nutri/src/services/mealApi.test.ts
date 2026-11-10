import { describe, expect, it } from 'vitest';
import { getDailyMeals, koreanDate, saveMeal, toEvaluation } from './mealApi';
import type { NutrientKey } from '../types';

describe('식사 기록', () => {
  it('한국 자정에서 날짜를 나눈다', () => {
    expect(koreanDate(new Date('2026-10-27T14:59:59Z'))).toBe('2026-10-27');
    expect(koreanDate(new Date('2026-10-27T15:00:00Z'))).toBe('2026-10-28');
  });

  it('회원 저장과 조회는 정적 버전에서 거절한다', async () => {
    const profile = { gender: 'male' as const, age: 14, height: 165, weight: 55, mealsPerDay: 3 };
    await expect(saveMeal(profile, [], 'request-123', '2026-10-27T15:00:00Z')).rejects.toThrow('회원 기록');
    await expect(getDailyMeals('2026-10-28')).rejects.toThrow('회원 기록');
  });

  it('미확인 값과 상한값을 화면 평가 결과에 유지한다', () => {
    const input = { calcium: { actual: null, target: 950, upperLimit: 3000, status: 'UNKNOWN',
      ratio: null, quality: 'MISSING' } };
    const result = toEvaluation(input as Record<NutrientKey, typeof input.calcium>);
    expect(result.calcium.value).toBeNull();
    expect(result.calcium.status).toBe('unknown');
    expect(result.calcium.upperLimit).toBe(3000);
  });
});
