import { apiFetch } from './apiClient';
import { toUiFood, type BackendFood } from './foodApi';
import { toBackendProfile } from './accountApi';
import type {
  AnalysisWarning,
  Evaluation,
  EvaluationStatus,
  MealAnalysis,
  MealItem,
  NutrientKey,
  Profile,
  ConfirmedMeal,
  Totals,
} from '../types';

const STATUS_MAP: Record<string, EvaluationStatus> = {
  LOW: 'deficient',
  ADEQUATE: 'ok',
  HIGH: 'over',
  UNKNOWN: 'unknown',
};

export interface BackendNutrientResult {
  status: keyof typeof STATUS_MAP;
  actual: number | null;
  target?: number | null;
  upperLimit?: number | null;
  ratio: number | null;
  quality?: string;
}

interface BackendRecommendation {
  food: BackendFood;
  reasonNutrients: NutrientKey[];
  score: number;
}

export interface AnalyzeMealResponse {
  nutrients: Record<NutrientKey, BackendNutrientResult>;
  recommendations: BackendRecommendation[];
  warnings: AnalysisWarning[];
}

function mealPayload(profile: Profile, mealItems: MealItem[], eatenAt: string) {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', hour: 'numeric', hourCycle: 'h23',
  }).format(new Date(eatenAt));
  const mealType = Number(hour) < 11 ? 'BREAKFAST' : Number(hour) < 16 ? 'LUNCH' : 'DINNER';
  return {
    mealType, eatenAt, profile: toBackendProfile(profile),
    items: mealItems.map(({ food, qty }) => ({ foodId: food.id, quantity: qty, quantityUnit: 'SERVING' })),
    recommendationScope: 'CU_ONLY',
  };
}

export function toEvaluation(nutrients: Record<NutrientKey, BackendNutrientResult>): Evaluation {
  return Object.fromEntries(
    (Object.entries(nutrients) as [NutrientKey, BackendNutrientResult][]).map(([key, value]) => [
      key, { status: STATUS_MAP[value.status], value: value.actual, goal: value.target ?? null,
        upperLimit: value.upperLimit ?? null, ratio: value.ratio,
        partial: value.quality === 'MIXED', quality: value.quality },
    ]),
  ) as Evaluation;
}

export async function analyzeMeal(profile: Profile, mealItems: MealItem[]): Promise<MealAnalysis> {
  const response = await apiFetch<AnalyzeMealResponse>('/meals/analyze', {
    method: 'POST',
    body: JSON.stringify(mealPayload(profile, mealItems, new Date().toISOString())),
  });

  return toUiAnalysis(response);
}

function toUiAnalysis(response: AnalyzeMealResponse): MealAnalysis {
  return {
    evaluation: toEvaluation(response.nutrients),
    recommendations: (response.recommendations ?? []).map((item) => ({
      food: toUiFood(item.food),
      reasonKeys: item.reasonNutrients,
      score: item.score,
    })),
    warnings: response.warnings ?? [],
  };
}

interface SavedMeal {
  id: string;
  clientRequestId: string;
  eatenAt: string;
  items: { foodId: string; name: string; quantity: number }[];
  analysis: AnalyzeMealResponse;
}

export interface DailyResponse {
  date: string;
  isPartial: boolean;
  meals: SavedMeal[];
  dailyAnalysis: { nutrients: Record<NutrientKey, BackendNutrientResult>; warnings: AnalysisWarning[] };
}

export function koreanDate(value = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function toConfirmedMeal(meal: SavedMeal): ConfirmedMeal {
  const totals = Object.fromEntries(Object.entries(meal.analysis.nutrients).map(([key, value]) => [
    key, { value: value.actual ?? 0, hasAny: value.actual !== null, hasUnknown: value.actual === null },
  ])) as Totals;
  return {
    clientMealId: meal.clientRequestId, dateKey: koreanDate(new Date(meal.eatenAt)),
    items: meal.items.map((item) => ({ foodId: item.foodId, name: item.name, qty: item.quantity })),
    totals, confirmedAt: meal.eatenAt, analysis: toUiAnalysis(meal.analysis),
  };
}

export async function saveMeal(profile: Profile, mealItems: MealItem[], clientRequestId: string, eatenAt: string) {
  const result = await apiFetch<SavedMeal>('/meals', { method: 'POST', body: JSON.stringify({
    ...mealPayload(profile, mealItems, eatenAt), clientRequestId,
  }) });
  return toConfirmedMeal(result);
}

export function getDailyMeals(date: string): Promise<DailyResponse> {
  return apiFetch(`/meals/daily/${encodeURIComponent(date)}`);
}
