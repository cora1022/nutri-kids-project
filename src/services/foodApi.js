import { ApiError, apiFetch } from './apiClient';

const NUTRIENT_KEYS = [
  'kcal',
  'protein',
  'calcium',
  'iron',
  'vitaminA',
  'vitaminC',
  'sodium',
];

// 백엔드 계약을 현재 UI가 사용하는 식품 객체로 변환합니다.
export function toUiFood(food) {
  const nutrients = Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [key, food.nutrients?.[key]?.value ?? null]),
  );
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
    barcode: food.barcode,
    price: food.price,
    imageUrl: food.imageUrl,
  };
}

export async function searchFoods(query) {
  const q = query.trim();
  if (!q) return [];
  const result = await apiFetch(`/foods?query=${encodeURIComponent(q)}&page=1&size=20`);
  return result.items.map(toUiFood);
}

export async function findByBarcode(code) {
  try {
    const food = await apiFetch(`/foods/barcode/${encodeURIComponent(code)}`);
    return toUiFood(food);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function getFood(id) {
  try {
    const food = await apiFetch(`/foods/${encodeURIComponent(id)}`);
    return toUiFood(food);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
