import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/server-analysis.json';
import { analyzeMealLocally, rounded, type AnalyzeRequest } from './nutritionEngine';
import type { BackendFood } from './foodApi';

describe('정적 영양 분석 엔진', () => {
  it('파이썬 Decimal과 같은 방식으로 반올림한다', () => {
    expect(rounded(5.5649999999999995)).toBe(5.56);
    expect(rounded(1.005)).toBe(1.01);
    expect(rounded(0.12345, 4)).toBe(0.1235);
    expect(rounded(1e-9)).toBe(0);
    expect(rounded(null)).toBeNull();
  });

  it('운영 서버 분석 결과와 같은 값을 낸다', () => {
    const result = analyzeMealLocally(fixture.request as AnalyzeRequest, fixture.catalog as BackendFood[]);
    expect(result.nutrients).toEqual(fixture.expected.nutrients);
    expect(result.totalPrice).toBe(fixture.expected.totalPrice);
    expect(result.recommendations.map((item) => ({ id: item.food.id, score: item.score, reasonNutrients: item.reasonNutrients })))
      .toEqual(fixture.expected.recommendations);
    expect(result.warnings.map((item) => item.code)).toEqual(fixture.expected.warningCodes);
  });

  it('등록되지 않은 상품과 지원하지 않는 연령은 오류로 알린다', () => {
    const request = fixture.request as AnalyzeRequest;
    expect(() => analyzeMealLocally({ ...request, items: [{ foodId: 'cu:none', quantity: 1, quantityUnit: 'SERVING' }] }, []))
      .toThrow('등록되지 않은 상품입니다: cu:none');
    expect(() => analyzeMealLocally({ ...request, profile: { ...request.profile, age: 19 } }, fixture.catalog as BackendFood[]))
      .toThrow('지원 연령은 만 6-18세입니다.');
  });
});

describe('상품 검색', () => {
  it('상품명과 브랜드에서 대소문자 구분 없이 찾는다', async () => {
    const { searchCatalog } = await import('./catalog');
    const foods = fixture.catalog as BackendFood[];
    const target = foods[0];
    expect(searchCatalog(foods, target.name.slice(0, 3)).map((food) => food.id)).toContain(target.id);
    expect(searchCatalog(foods, '   ')).toEqual([]);
  });
});
