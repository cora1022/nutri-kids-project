// 운영 API의 상품 목록을 정적 사이트용 JSON으로 내려받습니다.
// 사용법: node scripts/export-foods.mjs [API 주소]
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiBase = (process.argv[2] || 'https://nutri.cora1022.com/api/v1').replace(/\/$/, '');
const output = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/foods.json');
const size = 100;

const items = [];
for (let page = 1; ; page += 1) {
  const response = await fetch(`${apiBase}/foods?page=${page}&size=${size}`);
  if (!response.ok) throw new Error(`${page}쪽 요청 실패: HTTP ${response.status}`);
  const body = await response.json();
  items.push(...body.items);
  if (!body.hasNext) break;
}

// 검색 API와 같은 순서와 조건을 유지하고, 혹시 모를 중복 id는 하나만 남깁니다.
const unique = [...new Map(items.map((item) => [item.id, item])).values()];
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ exportedAt: new Date().toISOString(), items: unique }));
console.log(`${unique.length}개 상품을 ${output}에 저장했습니다.`);
