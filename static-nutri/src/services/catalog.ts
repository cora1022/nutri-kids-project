import type { BackendFood } from './foodApi';

// 정적 배포본은 서버 대신 public/data/foods.json에 내보낸 상품 목록을 사용합니다.
// 파일은 scripts/export-foods.mjs로 운영 API에서 다시 만들 수 있습니다.
let pending: Promise<BackendFood[]> | null = null;

export function loadCatalog(): Promise<BackendFood[]> {
  pending ??= fetch(`${import.meta.env.BASE_URL}data/foods.json`)
    .then((response) => {
      if (!response.ok) throw new Error('상품 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      return response.json() as Promise<{ items: BackendFood[] }>;
    })
    .then((body) => body.items)
    .catch((error: unknown) => {
      pending = null;
      throw error instanceof Error ? error : new Error('상품 목록을 불러오지 못했어요.');
    });
  return pending;
}

// 서버 검색과 같이 상품명이나 브랜드에 검색어가 포함된 상품을 이름순으로 돌려줍니다.
export function searchCatalog(foods: BackendFood[], query: string, size = 20): BackendFood[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return foods.filter((food) => food.itemReportNo
    && (food.name.toLowerCase().includes(q) || (food.brand ?? '').toLowerCase().includes(q))).slice(0, size);
}
