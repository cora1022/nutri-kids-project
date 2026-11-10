import { describe, expect, it } from 'vitest';
import { energyPercent, formatAmount, nutrientLabel, resultSummary } from './resultPresentation';
import type { Evaluation, EvaluationItem } from '../types';

const value: EvaluationItem = { status: 'unknown', value: 3, goal: null, ratio: null };
describe('결과 화면 표시', () => {
  it('미확인 값을 0으로 표시하거나 열량 달성률로 바꾸지 않는다', () => {
    expect(formatAmount(null)).toBe('미확인');
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(0.03)).toBe('0.03');
    expect(energyPercent({ ...value, value: null, ratio: 0 })).toBeNull();
    expect(energyPercent({ ...value, value: 520, goal: 800, ratio: .65 })).toBe(65);
  });
  it('평가 범위 밖 성분과 충분섭취량 미달을 부족으로 단정하지 않는다', () => {
    expect(nutrientLabel(value, 'unassessed')).toBe('섭취량');
    expect(nutrientLabel({ ...value, goal: 5, ratio: .6 }, 'adequateIntake')).toBe('기준 참고');
    expect(nutrientLabel({ ...value, value: null }, 'target')).toBe('미확인');
  });
  it('실제 보완 판정이 있는 영양소만 요약에 사용한다', () => {
    const input = { sodium: { ...value, status: 'deficient' },
      vitaminD: { ...value, goal: 5, ratio: .6 },
      calcium: { ...value, goal: 300, status: 'deficient', ratio: .3 } } as Evaluation;
    const message = resultSummary(input);
    expect(message).toContain('칼슘');
    expect(message).not.toContain('나트륨');
    expect(message).not.toContain('비타민 D');
  });
});
