import { ApiError, apiFetch } from './apiClient';
import type { Food, NutrientKey, NutrientValues } from '../types';

const NUTRIENT_KEYS: NutrientKey[] = [
  'kcal',
  'protein',
  'carbohydrate',
  'calcium',
  'iron',
  'vitaminA',
  'vitaminC',
  'vitaminD',
  'sodium',
];

/** 백엔드 /foods 계약의 원본 응답 형태 (필요한 만큼만 선언) */
export interface BackendFood {
  id: string;
  name: string;
  brand?: string | null;
  sourceType: 'STANDARD_FOOD' | 'CVS_PRODUCT' | string;
  serving?: {
    label?: string;
    amount?: number | null;
    countUnit?: string;
  };
  nutrients?: Partial<Record<NutrientKey, { value: number | null }>>;
  overallQuality?: Food['overallQuality'];
  itemReportNo?: string | null;
  itemReportCandidates?: unknown[];
  itemReportStatus?: string | null;
  itemReportEvidence?: unknown;
  standardFoodMatch?: unknown;
  barcode?: string | null;
  price?: number | null;
  imageUrl?: string | null;
}

interface FoodSearchResponse {
  items: BackendFood[];
}

// 백엔드 계약을 현재 UI가 사용하는 식품 객체로 변환합니다.
export function toUiFood(food: BackendFood): Food {
  const nutrients = Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [key, food.nutrients?.[key]?.value ?? null]),
  ) as NutrientValues;

  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    category: food.sourceType === 'STANDARD_FOOD' ? 'general' : 'cvs',
    servingLabel: food.serving?.label || '제공량 미확인',
    servingSize: food.serving?.amount ?? null,
    unit: food.serving?.countUnit || '회',
    nutrients,
    nutrientDetails: food.nutrients,
    overallQuality: food.overallQuality,
    itemReportNo: food.itemReportNo,
    itemReportCandidates: food.itemReportCandidates || [],
    itemReportStatus: food.itemReportStatus,
    itemReportEvidence: food.itemReportEvidence,
    standardFoodMatch: food.standardFoodMatch,
    barcode: food.barcode,
    price: food.price,
    imageUrl: food.imageUrl,
  };
}

export async function searchFoods(query: string): Promise<Food[]> {
  const q = query.trim();
  if (!q) return [];
  const result = await apiFetch<FoodSearchResponse>(`/foods?query=${encodeURIComponent(q)}&page=1&size=20`);
  return result.items.map(toUiFood);
}

export async function findByBarcode(code: string): Promise<Food | null> {
  try {
    const food = await apiFetch<BackendFood>(`/foods/barcode/${encodeURIComponent(code)}`);
    return toUiFood(food);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function getFood(id: string): Promise<Food | null> {
  try {
    const food = await apiFetch<BackendFood>(`/foods/${encodeURIComponent(id)}`);
    return toUiFood(food);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
