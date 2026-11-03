import { expect, test, type Page } from '@playwright/test';

const PROFILE = { nickname: '든든친구', gender: 'male', age: 14, height: 165, weight: 55, mealsPerDay: 3 };
const nutrients = {
  kcal: { actual: 520, target: 800, ratio: .65, status: 'LOW', quality: 'ESTIMATED' },
  protein: { actual: 16, target: 20, ratio: .8, status: 'LOW', quality: 'ESTIMATED' },
  carbohydrate: { actual: 75, target: 115, ratio: 75 / 115, status: 'LOW', quality: 'ESTIMATED' },
  calcium: { actual: 180, target: 300, ratio: .6, status: 'LOW', quality: 'ESTIMATED' },
  vitaminC: { actual: 12, target: 30, ratio: .4, status: 'LOW', quality: 'ESTIMATED' },
  vitaminA: { actual: 180, target: 250, ratio: .72, status: 'LOW', quality: 'ESTIMATED' },
  vitaminD: { actual: null, target: 3.3, ratio: null, status: 'UNKNOWN', quality: 'MISSING' },
  iron: { actual: 3.2, target: null, ratio: null, status: 'UNKNOWN', quality: 'ESTIMATED' },
  sodium: { actual: 540, target: null, ratio: null, status: 'UNKNOWN', quality: 'ESTIMATED' },
};
const food = { id: 'cu:test', sourceType: 'CU_PRODUCT', name: '테스트 도시락', price: 4500,
  serving: { label: '1개', amount: 300, countUnit: '개' }, overallQuality: 'ESTIMATED',
  nutrients: Object.fromEntries(Object.entries(nutrients).map(([key, item]) => [key, { value: item.actual }])) };
const recommendation = { ...food, id: 'cu:milk', name: '흰 우유', price: 1600,
  serving: { label: '200ml', amount: 200, countUnit: '회' } };
const analysis = { nutrients, recommendations: [{ food: recommendation, reasonNutrients: ['calcium'], score: .5 }], warnings: [] };

async function setup(page: Page, member = false) {
  await page.addInitScript((profile) => { localStorage.setItem('nutrikids.profile', JSON.stringify(profile)); }, PROFILE);
  const account = { user: { id: 'usr_test', email: 'member@example.com', nickname: '든든친구', profileCompleted: true },
    profile: { nickname: '든든친구', sex: 'MALE', age: 14, heightCm: 165, weightKg: 55, mealsPerDay: 3 },
    goals: { method: 'test', daily: Object.fromEntries(Object.entries(nutrients).map(([key, item]) => [key, { value: item.target == null ? null : item.target * 3 }])),
      perMeal: Object.fromEntries(Object.entries(nutrients).map(([key, item]) => [key, { value: item.target }])) } };
  let saved: Record<string, unknown> | null = null;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/config')) return route.fulfill({ json: { googleEnabled: true } });
    if (path.endsWith('/users/me')) return route.fulfill({ status: member ? 200 : 401, json: member ? account : {} });
    if (path.endsWith('/users/me/profile')) {
      account.profile = request.postDataJSON();
      account.user.nickname = account.profile.nickname;
      return route.fulfill({ json: account });
    }
    if (path.endsWith('/foods')) return route.fulfill({ json: { items: [food] } });
    if (path.endsWith('/meals/analyze')) return route.fulfill({ json: analysis });
    if (path.endsWith('/meals')) {
      const payload = request.postDataJSON();
      saved = { id: 'meal_test', clientRequestId: payload.clientRequestId, eatenAt: payload.eatenAt,
        items: [{ foodId: food.id, name: food.name, quantity: 1 }], analysis };
      return route.fulfill({ status: 201, json: saved });
    }
    if (path.includes('/meals/daily/')) return route.fulfill({ json: {
      date: path.split('/').at(-1), isPartial: true, meals: saved ? [saved] : [],
      dailyAnalysis: { nutrients, warnings: [] },
    } });
    return route.fulfill({ status: 404, json: {} });
  });
}

async function prepareResult(page: Page) {
  await page.getByRole('textbox', { name: '상품명으로 검색' }).fill('도시락');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.getByRole('button', { name: /테스트 도시락/ }).click();
  await page.getByRole('button', { name: '이 양으로 담기' }).click();
  await page.getByRole('button', { name: '한 끼 평가로 이동' }).click();
  await expect(page.getByRole('heading', { name: '영양소 한눈에', exact: true })).toBeVisible();
}

test('저장된 게스트 프로필이 있어도 로그인과 게스트 선택이 먼저 보인다', async ({ page }, testInfo) => {
  await setup(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '구글 계정으로 로그인', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '게스트로 시작하기', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '설정', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('entry-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '구글 계정으로 로그인', exact: true }).click();
  await expect(page.getByRole('button', { name: '동의하고 구글로 계속하기' })).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: '동의하고 구글로 계속하기' })).toBeEnabled();
});

test('설정에서 게스트 프로필 수정 후 설정으로 돌아오고 이전 화면도 복원한다', async ({ page }, testInfo) => {
  await setup(page);
  await page.goto('/');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page.getByText('게스트로 이용 중')).toBeVisible();
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByLabel('키(cm)').fill('170');
  await page.getByRole('button', { name: '수정한 정보로 목표 다시 계산하기' }).click();
  await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible();
  await expect(page.getByText('170 cm', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('settings-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '이전 화면으로' }).click();
  await expect(page.getByRole('button', { name: '게스트로 시작하기', exact: true })).toBeVisible();
});

test('게스트의 분석, 미확인 성분, 추천 담기, 저장과 하루 기록이 이어진다', async ({ page }, testInfo) => {
  await setup(page);
  await page.goto('/');
  await page.getByRole('button', { name: '게스트로 시작하기', exact: true }).click();
  await prepareResult(page);
  await expect(page.getByText('65%', { exact: true })).toBeVisible();
  const vitaminD = page.locator('.overview-row').filter({ hasText: '비타민 D' });
  await expect(vitaminD).toContainText('미확인');
  await expect(vitaminD.locator('.overview-track')).toHaveClass(/track-missing/);
  await page.getByText('전체 영양소 보기', { exact: true }).click();
  await expect(page.locator('.overview-row').filter({ hasText: '나트륨' })).toContainText('섭취량');
  await page.screenshot({ path: testInfo.outputPath('result-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '담기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '오늘 뭘 먹었나요?' })).toBeVisible();
  await expect(page.locator('.meal-stack')).toContainText('흰 우유');
  await page.getByRole('button', { name: '최근 취소' }).click();
  await page.getByRole('button', { name: '한 끼 평가로 이동' }).click();
  await page.getByRole('button', { name: '식사 저장하기' }).click();
  await expect(page.getByText('식사를 이 브라우저에 저장했어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '식사 저장하기' })).toHaveCount(0);
  await page.getByRole('button', { name: '오늘 전체 보기' }).click();
  await expect(page.getByText('저장한 식사', { exact: true })).toBeVisible();
  await page.locator('.saved-meal-card > summary').click();
  await expect(page.locator('.saved-meal-body').getByRole('heading', { name: '영양소 한눈에' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('daily-mobile.png'), fullPage: true });
});

test('회원 저장은 API로 보내고 결과 재조회 후에도 저장 화면을 유지한다', async ({ page }, testInfo) => {
  await setup(page, true);
  await page.goto('/');
  await prepareResult(page);
  const savedRequest = page.waitForRequest((req) => new URL(req.url()).pathname.endsWith('/meals') && req.method() === 'POST');
  await page.getByRole('button', { name: '식사 저장하기' }).click();
  const request = await savedRequest;
  expect(request.postDataJSON().items[0].foodId).toBe('cu:test');
  expect(request.postDataJSON().clientRequestId).toBeTruthy();
  await expect(page.getByText('식사를 내 기록에 저장했어요')).toBeVisible();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page.getByText('구글 계정으로 로그인 중')).toBeVisible();
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('member-settings-mobile.png'), fullPage: true });
});

test('좁은 모바일 화면과 데스크톱에서 가로 넘침이 없다', async ({ page }, testInfo) => {
  await setup(page);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: '게스트로 시작하기', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: '게스트로 시작하기', exact: true }).click();
    await prepareResult(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 1440) await page.screenshot({ path: testInfo.outputPath('result-desktop.png'), fullPage: true });
  }
});
