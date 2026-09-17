import { NUTRIENT_META } from '../data/goals';
import { FOODS } from '../data/foods';

// 스택에 담긴 항목: { food, qty }  (qty = 배수, 1 = servingSize 그대로)

export function computeItemNutrients(food, qty) {
  const result = {};
  NUTRIENT_META.forEach(({ key }) => {
    const base = food.nutrients[key];
    result[key] = base === null || base === undefined ? null : base * qty;
  });
  return result;
}

// 여러 항목의 합계를 낸다. 하나라도 null(미확인)이 있으면 해당 영양소는 '미확인'으로 표시하되,
// 확인된 값만이라도 참고용으로 합산해 함께 반환한다. (0으로 취급하지 않음)
export function sumNutrients(items) {
  const totals = {};
  NUTRIENT_META.forEach(({ key }) => {
    let sum = 0;
    let hasUnknown = false;
    let hasAny = false;
    items.forEach(({ food, qty }) => {
      const v = food.nutrients[key];
      if (v === null || v === undefined) {
        hasUnknown = true;
      } else {
        sum += v * qty;
        hasAny = true;
      }
    });
    totals[key] = { value: hasAny ? sum : 0, hasUnknown, hasAny };
  });
  return totals;
}

export function addTotals(a, b) {
  const out = {};
  NUTRIENT_META.forEach(({ key }) => {
    out[key] = {
      value: a[key].value + b[key].value,
      hasUnknown: a[key].hasUnknown || b[key].hasUnknown,
      hasAny: a[key].hasAny || b[key].hasAny,
    };
  });
  return out;
}

export const STATUS = {
  DEFICIENT: 'deficient', // 부족
  OK: 'ok', // 적정
  OVER: 'over', // 초과 (상한 기준 초과, 또는 목표 대비 크게 초과)
  UNKNOWN: 'unknown', // 미확인 성분이 있어 판정 보류
};

const OVER_RATIO = 1.3; // target류는 목표의 130% 넘으면 '초과'로 표시(참고용)

export function evaluateNutrients(totals, goals) {
  const evaluation = {};
  NUTRIENT_META.forEach(({ key, kind }) => {
    const t = totals[key];
    const goal = goals[key];
    if (t.hasUnknown && !t.hasAny) {
      evaluation[key] = { status: STATUS.UNKNOWN, value: t.value, goal, ratio: null };
      return;
    }
    if (kind === 'upperLimit') {
      const status = t.value > goal ? STATUS.OVER : STATUS.OK;
      evaluation[key] = { status, value: t.value, goal, ratio: t.value / goal, partial: t.hasUnknown };
      return;
    }
    const ratio = t.value / goal;
    let status = STATUS.OK;
    if (ratio < 0.85) status = STATUS.DEFICIENT;
    else if (ratio > OVER_RATIO) status = STATUS.OVER;
    evaluation[key] = { status, value: t.value, goal, ratio, partial: t.hasUnknown };
  });
  return evaluation;
}

export function getDeficientKeys(evaluation) {
  return NUTRIENT_META.filter(
    ({ key, kind }) => kind === 'target' && evaluation[key].status === STATUS.DEFICIENT
  ).map((n) => n.key);
}

// 추천 후보 계산: 부족한 영양소를 잘 채우면서
// 남은 칼로리·나트륨 여유를 크게 넘기지 않는 식품을 고른다.
export function recommendFoods({ totals, goals, deficientKeys, excludeIds = [] }) {
  if (deficientKeys.length === 0) return { candidates: [], reason: null };

  const remainingKcal = Math.max(goals.kcal - totals.kcal.value, 0);
  const remainingSodium = Math.max(goals.sodium - totals.sodium.value, 0);

  const scored = FOODS.filter((f) => !excludeIds.includes(f.id))
    .map((food) => {
      let score = 0;
      deficientKeys.forEach((key) => {
        const contrib = food.nutrients[key];
        if (contrib) {
          const deficit = Math.max(goals[key] - totals[key].value, 1);
          score += Math.min(contrib / deficit, 1); // 0~1로 정규화해 합산
        }
      });
      return { food, score };
    })
    .filter((c) => c.score > 0);

  // 칼로리 예산을 지나치게 초과(150%)하거나 나트륨 여유를 초과하는 후보는 제외
  const feasible = scored.filter(({ food }) => {
    const kcalOk = remainingKcal <= 0 ? true : food.nutrients.kcal <= remainingKcal * 1.5;
    const sodiumOk = food.nutrients.sodium === null ? true : food.nutrients.sodium <= remainingSodium + 400;
    return kcalOk && sodiumOk;
  });

  const pool = feasible.length > 0 ? feasible : [];
  const sorted = pool.sort((a, b) => b.score - a.score).slice(0, 3);

  if (sorted.length === 0) {
    return {
      candidates: [],
      reason: '남은 칼로리·나트륨 여유 안에서 조건에 맞는 식품을 찾지 못했어요.',
    };
  }

  return {
    candidates: sorted.map(({ food, score }) => ({
      food,
      score,
      reasonKeys: deficientKeys.filter((k) => food.nutrients[k] && food.nutrients[k] > 0),
    })),
    reason: null,
  };
}
