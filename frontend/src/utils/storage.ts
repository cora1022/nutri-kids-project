// 지금은 localStorage로 동작하지만, 함수 시그니처는 백엔드 API와 1:1로
// 맞춰뒀습니다. 나중에 각 함수 내부만 fetch(...) 호출로 바꾸면 됩니다.

import type { ConfirmedMeal, MealItem, Profile } from '../types';

const PROFILE_KEY = 'nutrikids.profile';
const DRAFT_KEY = 'nutrikids.draftMeal'; // 현재 입력 중인(미확정) 한 끼
const MEALS_KEY = 'nutrikids.mealsByDate'; // 날짜별 확정된 식사들

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function saveProfile(profile: Profile): boolean {
  return write(PROFILE_KEY, profile);
}

export function loadProfile(): Profile | null {
  return read<Profile | null>(PROFILE_KEY, null);
}

export function saveDraftMeal(dateKey: string, items: MealItem[]): boolean {
  const all = read<Record<string, MealItem[]>>(DRAFT_KEY, {});
  all[dateKey] = items;
  return write(DRAFT_KEY, all);
}

export function loadDraftMeal(dateKey: string): MealItem[] {
  const all = read<Record<string, MealItem[]>>(DRAFT_KEY, {});
  return all[dateKey] || [];
}

export function clearDraftMeal(dateKey: string): boolean {
  const all = read<Record<string, MealItem[]>>(DRAFT_KEY, {});
  delete all[dateKey];
  return write(DRAFT_KEY, all);
}

// 식사 저장: 성공/실패를 흉내 낼 수 있도록 async + 예외 가능성을 유지합니다.
// (백엔드 저장 실패 시 "임시 기록 유지 + 재시도" 흐름을 그대로 살리기 위함)
export async function saveConfirmedMeal(dateKey: string, mealRecord: ConfirmedMeal): Promise<ConfirmedMeal> {
  await new Promise((r) => setTimeout(r, 250)); // 네트워크 흉내
  const all = read<Record<string, ConfirmedMeal[]>>(MEALS_KEY, {});
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

export function loadMealsByDate(dateKey: string): ConfirmedMeal[] {
  const all = read<Record<string, ConfirmedMeal[]>>(MEALS_KEY, {});
  return all[dateKey] || [];
}

export function listRecordedDates(): string[] {
  const all = read<Record<string, ConfirmedMeal[]>>(MEALS_KEY, {});
  return Object.keys(all).sort();
}
