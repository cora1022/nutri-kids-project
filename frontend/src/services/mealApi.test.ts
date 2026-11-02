import { afterEach, describe, expect, it, vi } from 'vitest';
import { koreanDate, saveMeal, toEvaluation } from './mealApi';
import type { Food, NutrientKey } from '../types';

afterEach(() => { vi.unstubAllGlobals(); });

describe('회원 식사 저장', () => {
  it('한국 자정에서 날짜를 나눈다', () => {
    expect(koreanDate(new Date('2026-10-27T14:59:59Z'))).toBe('2026-10-27');
    expect(koreanDate(new Date('2026-10-27T15:00:00Z'))).toBe('2026-10-28');
  });

  it('재시도해도 요청 ID와 먹은 시간을 유지하고 서버 결과를 사용한다', async () => {
    const serverMeal = { id: 'meal_1', clientRequestId: 'request-123', eatenAt: '2026-10-27T15:00:00Z',
      items: [{ foodId: 'cu:test', name: '테스트 우유', quantity: 1 }],
      analysis: { nutrients: { kcal: { actual: 100, quality: 'CONFIRMED' },
        vitaminD: { actual: null, quality: 'MISSING' } } } };
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(serverMeal))));
    vi.stubGlobal('fetch', fetch);
    const profile = { gender: 'male' as const, age: 14, height: 165, weight: 55, mealsPerDay: 3 };
    const food: Food = { id: 'cu:test', name: '테스트 우유', category: 'cvs', servingLabel: '1회',
      servingSize: 200, unit: '회', nutrients: { kcal: 999 } };
    const items = [{ food, qty: 1, key: 'draft-key' }];
    const first = await saveMeal(profile, items, 'request-123', '2026-10-27T15:00:00Z');
    await saveMeal(profile, items, 'request-123', '2026-10-27T15:00:00Z');
    expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
    expect(JSON.parse(fetch.mock.calls[0][1].body).mealType).toBe('BREAKFAST');
    expect(first.totals.kcal.value).toBe(100);
    expect(first.totals.vitaminD.hasUnknown).toBe(true);
    expect(first.dateKey).toBe('2026-10-28');
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
