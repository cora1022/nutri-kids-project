import { NUTRIENT_META } from '../data/goals';
import { FOODS } from '../data/foods';
import type {
  Evaluation,
  EvaluationStatus,
  Food,
  Goals,
  MealItem,
  NutrientKey,
  NutrientTotal,
  RecommendationCandidate,
  RecommendationResult,
  Totals,
} from '../types';

export function computeItemNutrients(food: Food, qty: number): Record<NutrientKey, number | null> {
  const result = {} as Record<NutrientKey, number | null>;
  NUTRIENT_META.forEach(({ key }) => {
    const base = food.nutrients[key];
    result[key] = base === null || base === undefined ? null : base * qty;
  });
  return result;
}

// 미확인 성분을 0으로 바꾸지 않고, 확인된 값의 합계와 누락 여부를 함께 보관합니다.
export function sumNutrients(items: MealItem[]): Totals {
  const totals = {} as Totals;
  NUTRIENT_META.forEach(({ key }) => {
    let sum = 0;
    let hasUnknown = false;
    let hasAny = false;
    items.forEach(({ food, qty }) => {
      const value = food.nutrients[key];
      if (value === null || value === undefined) {
        hasUnknown = true;
      } else {
        sum += value * qty;
        hasAny = true;
      }
    });
    totals[key] = { value: hasAny ? sum : 0, hasUnknown, hasAny };
  });
  return totals;
}

export function addTotals(a: Totals, b: Totals): Totals {
  const result = {} as Totals;
  NUTRIENT_META.forEach(({ key }) => {
    result[key] = {
      value: a[key].value + b[key].value,
      hasUnknown: a[key].hasUnknown || b[key].hasUnknown,
      hasAny: a[key].hasAny || b[key].hasAny,
    };
  });
  return result;
}

export const STATUS: Record<'DEFICIENT' | 'OK' | 'OVER' | 'UNKNOWN', EvaluationStatus> = {
  DEFICIENT: 'deficient',
  OK: 'ok',
  OVER: 'over',
  UNKNOWN: 'unknown',
};

export function evaluateNutrients(totals: Totals, goals: Goals): Evaluation {
  const evaluation = {} as Evaluation;

  NUTRIENT_META.forEach(({ key, kind }) => {
    const total: NutrientTotal = totals[key];
    const goal = goals[key];

    if (!total.hasAny || total.hasUnknown || goal === null || kind === 'unassessed') {
      evaluation[key] = {
        status: STATUS.UNKNOWN,
        value: total.hasAny ? total.value : null,
        goal,
        ratio: null,
        partial: total.hasUnknown && total.hasAny,
      };
      return;
    }

    const ratio = total.value / goal;
    let status: EvaluationStatus;

    if (key === 'kcal') {
      status = ratio < 0.8 ? STATUS.DEFICIENT : ratio > 1.2 ? STATUS.OVER : STATUS.OK;
    } else if (key === 'carbohydrate') {
      const lowerRatio = 0.5 / 0.575;
      const upperRatio = 0.65 / 0.575;
      status = ratio < lowerRatio ? STATUS.DEFICIENT : ratio > upperRatio ? STATUS.OVER : STATUS.OK;
    } else if (kind === 'adequateIntake') {
      status = ratio >= 1 ? STATUS.OK : STATUS.UNKNOWN;
    } else {
      status = ratio >= 1 ? STATUS.OK : STATUS.DEFICIENT;
    }

    evaluation[key] = { status, value: total.value, goal, ratio };
  });

  return evaluation;
}

export function getDeficientKeys(evaluation: Evaluation): NutrientKey[] {
  return NUTRIENT_META.filter(
    ({ key, kind }) => kind === 'target' && evaluation[key].status === STATUS.DEFICIENT,
  ).map(({ key }) => key);
}

interface RecommendFoodsArgs {
  totals: Totals;
  goals: Goals;
  deficientKeys: NutrientKey[];
  excludeIds?: string[];
}

// 부족한 영양소를 채우면서 남은 열량을 크게 넘지 않는 후보를 고릅니다.
export function recommendFoods({
  totals,
  goals,
  deficientKeys,
  excludeIds = [],
}: RecommendFoodsArgs): RecommendationResult {
  if (deficientKeys.length === 0) return { candidates: [], reason: null };

  const remainingKcal = Math.max((goals.kcal ?? 0) - totals.kcal.value, 0);
  const scored = FOODS.filter((food) => !excludeIds.includes(food.id))
    .map((food) => {
      let score = 0;
      deficientKeys.forEach((key) => {
        const contribution = food.nutrients[key];
        const goal = goals[key];
        if (contribution !== null && contribution !== undefined && contribution > 0 && goal !== null) {
          const deficit = Math.max(goal - totals[key].value, 1);
          score += Math.min(contribution / deficit, 1);
        }
      });
      return { food, score };
    })
    .filter(({ score }) => score > 0);

  const feasible = scored.filter(({ food }) => {
    const kcal = food.nutrients.kcal;
    return remainingKcal <= 0 || kcal === null || kcal === undefined || kcal <= remainingKcal * 1.5;
  });

  const sorted = feasible.sort((a, b) => b.score - a.score).slice(0, 3);
  if (sorted.length === 0) {
    return {
      candidates: [],
      reason: '남은 열량 안에서 조건에 맞는 식품을 찾지 못했어요.',
    };
  }

  const candidates: RecommendationCandidate[] = sorted.map(({ food, score }) => ({
    food,
    score,
    reasonKeys: deficientKeys.filter((key) => {
      const value = food.nutrients[key];
      return value !== null && value !== undefined && value > 0;
    }),
  }));

  return { candidates, reason: null };
}
