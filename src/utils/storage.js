// 지금은 localStorage로 동작하지만, 함수 시그니처는 백엔드 API와 1:1로
// 맞춰뒀습니다. 나중에 각 함수 내부만 fetch(...) 호출로 바꾸면 됩니다.

const PROFILE_KEY = 'nutrikids.profile';
const DRAFT_KEY = 'nutrikids.draftMeal'; // 현재 입력 중인(미확정) 한 끼
const MEALS_KEY = 'nutrikids.mealsByDate'; // 날짜별 확정된 식사들

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function saveProfile(profile) {
  return write(PROFILE_KEY, profile);
}

export function loadProfile() {
  return read(PROFILE_KEY, null);
}

export function saveDraftMeal(dateKey, items) {
  const all = read(DRAFT_KEY, {});
  all[dateKey] = items;
  return write(DRAFT_KEY, all);
}

export function loadDraftMeal(dateKey) {
  const all = read(DRAFT_KEY, {});
  return all[dateKey] || [];
}

export function clearDraftMeal(dateKey) {
  const all = read(DRAFT_KEY, {});
  delete all[dateKey];
  return write(DRAFT_KEY, all);
}

// 식사 저장: 성공/실패를 흉내 낼 수 있도록 async + 예외 가능성을 유지합니다.
// (백엔드 저장 실패 시 "임시 기록 유지 + 재시도" 흐름을 그대로 살리기 위함)
export async function saveConfirmedMeal(dateKey, mealRecord) {
  await new Promise((r) => setTimeout(r, 250)); // 네트워크 흉내
  const all = read(MEALS_KEY, {});
  const dayMeals = all[dateKey] || [];

  // 중복 저장 방지: 같은 clientMealId가 이미 있으면 갱신만 한다
  const existingIdx = dayMeals.findIndex((m) => m.clientMealId === mealRecord.clientMealId);
  if (existingIdx >= 0) {
    dayMeals[existingIdx] = mealRecord;
  } else {
    dayMeals.push(mealRecord);
  }
  all[dateKey] = dayMeals;
  const ok = write(MEALS_KEY, all);
  if (!ok) throw new Error('저장에 실패했어요');
  return mealRecord;
}

export function loadMealsByDate(dateKey) {
  const all = read(MEALS_KEY, {});
  return all[dateKey] || [];
}

export function listRecordedDates() {
  const all = read(MEALS_KEY, {});
  return Object.keys(all).sort();
}
