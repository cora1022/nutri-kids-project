import { apiFetch } from './apiClient';
import { toUiFood, type BackendFood } from './foodApi';
import type { Evaluation, EvaluationStatus, MealAnalysis, MealItem, NutrientKey, Profile } from '../types';

const STATUS_MAP: Record<string, EvaluationStatus> = {
  LOW: 'deficient',
  ADEQUATE: 'ok',
  HIGH: 'over',
  UNKNOWN: 'unknown',
};

interface BackendNutrientResult {
  status: keyof typeof STATUS_MAP;
  actual: number | null;
  target?: number;
  upperLimit?: number;
  ratio: number | null;
  quality?: string;
}

interface BackendRecommendation {
  food: BackendFood;
  reasonNutrients: NutrientKey[];
  score: number;
}

interface AnalyzeMealResponse {
  nutrients: Record<NutrientKey, BackendNutrientResult>;
  recommendations: BackendRecommendation[];
  warnings: string[];
}

export async function analyzeMeal(profile: Profile, mealItems: MealItem[]): Promise<MealAnalysis> {
  const response = await apiFetch<AnalyzeMealResponse>('/meals/analyze', {
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

  const evaluation = Object.fromEntries(
    (Object.entries(response.nutrients) as [NutrientKey, BackendNutrientResult][]).map(([key, value]) => [
      key,
      {
        status: STATUS_MAP[value.status],
        value: value.actual,
        goal: value.target ?? value.upperLimit ?? 0,
        ratio: value.ratio,
        partial: value.quality === 'MIXED',
        quality: value.quality,
      },
    ]),
  ) as Evaluation;

  return {
    evaluation,
    recommendations: response.recommendations.map((item) => ({
      food: toUiFood(item.food),
      reasonKeys: item.reasonNutrients,
      score: item.score,
    })),
    warnings: response.warnings,
  };
}
