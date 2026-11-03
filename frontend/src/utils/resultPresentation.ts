import { NUTRIENT_META } from '../data/goals';
import type { Evaluation, EvaluationItem, NutrientKind } from '../types';

export function formatAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '미확인';
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: Math.abs(value) < 0.1 ? 2 : 1 }).format(value);
}

export function nutrientLabel(item: EvaluationItem | undefined, kind: NutrientKind): string {
  if (!item || item.value == null) return '미확인';
  if (kind === 'unassessed' || item.goal == null) return '섭취량';
  if (item.status === 'deficient') return '보완';
  if (item.status === 'ok') return '목표 범위';
  if (item.status === 'over') return '목표 초과';
  return '기준 참고';
}

export function resultSummary(evaluation: Evaluation): string {
  const low = NUTRIENT_META.filter(({ key, kind }) => key !== 'kcal' && kind === 'target'
    && evaluation[key]?.value != null && evaluation[key].status === 'deficient')
    .sort((a, b) => (evaluation[a.key].ratio ?? 1) - (evaluation[b.key].ratio ?? 1));
  if (low.length > 0) return `${low.slice(0, 2).map((item) => item.label).join(', ')} 보완을 추천해요`;
  const known = NUTRIENT_META.filter(({ key, kind }) => kind !== 'unassessed'
    && evaluation[key]?.value != null && evaluation[key].status !== 'unknown');
  if (!known.length) return '영양 정보가 부족해요. 확인된 값부터 살펴보세요';
  if (known.some(({ key }) => evaluation[key].status === 'over')) return '목표를 넘은 항목을 함께 살펴보세요';
  if (NUTRIENT_META.some(({ key }) => evaluation[key]?.value == null)) return '확인된 영양소는 목표 범위에 있어요';
  return '이번 기록의 영양 균형을 확인해 보세요';
}

export function energyPercent(item: EvaluationItem | undefined): number | null {
  if (!item || item.value == null || item.goal == null || item.ratio == null || !Number.isFinite(item.ratio)) return null;
  return Math.max(0, Math.round(item.ratio * 100));
}

export function mealDateLabel(date: Date): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hourCycle: 'h23' }).format(date));
  const day = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(date);
  return `${day} ${hour < 11 ? '아침' : hour < 16 ? '점심' : '저녁'}`;
}
