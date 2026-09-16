import { FOODS, getFoodById } from '../data/foods';

// 실제 연동 시 이 파일만 fetch('/api/foods/search?q=...') 등으로 교체하면 됩니다.
// UI 컴포넌트는 이 함수의 시그니처(입력/출력 모양)만 알면 되도록 분리했습니다.

export async function searchFoods(query) {
  await new Promise((r) => setTimeout(r, 150));
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return FOODS.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      (f.brand && f.brand.toLowerCase().includes(q))
  );
}

export async function findByBarcode(code) {
  await new Promise((r) => setTimeout(r, 150));
  // 데모용: 바코드 마지막 자리로 임의 매칭 (실 서비스에서는 정확한 바코드 매핑 사용)
  return FOODS.find((f) => f.id.endsWith(code.slice(-3))) || null;
}

export async function getFood(id) {
  await new Promise((r) => setTimeout(r, 50));
  return getFoodById(id);
}
