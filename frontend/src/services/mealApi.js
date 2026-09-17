import { apiFetch } from './apiClient';
import { toUiFood } from './foodApi';

const STATUS_MAP = { LOW: 'deficient', ADEQUATE: 'ok', HIGH: 'over', UNKNOWN: 'unknown' };

export async function analyzeMeal(profile, mealItems) {
  const response = await apiFetch('/meals/analyze', {
    method: 'POST',
    body: JSON.stringify({
      mealType: 'LUNCH',
      eatenAt: new Date().toISOString(),
      profile: {
        sex: profile.gender === 'female' ? 'FEMALE' : 'MALE',
        age: Number(profile.age),
        heightCm: Number(profile.height),
        weightKg: Number(profile.weight),
        mealsPerDay: Number(profile.mealsPerDay),
      },
      items: mealItems.map(({ food, qty }) => ({
        foodId: food.id,
        quantity: qty,
        quantityUnit: 'SERVING',
      })),
      recommendationScope: 'CU_ONLY',
    }),
  });
  return {
    evaluation: Object.fromEntries(Object.entries(response.nutrients).map(([key, value]) => [key, {
      status: STATUS_MAP[value.status],
      value: value.actual,
      goal: value.target ?? value.upperLimit,
      ratio: value.ratio,
      partial: value.quality === 'MIXED',
      quality: value.quality,
    }])),
    recommendations: response.recommendations.map((item) => ({
      food: toUiFood(item.food),
      reasonKeys: item.reasonNutrients,
      score: item.score,
    })),
    warnings: response.warnings,
  };
}
