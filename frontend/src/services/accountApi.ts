import { API_BASE_URL, ApiError, apiFetch } from './apiClient';
import type { AuthUser, Goals, NutrientKey, Profile } from '../types';

interface BackendProfile {
  nickname: string;
  sex: 'MALE' | 'FEMALE';
  age: number;
  heightCm: number;
  weightKg: number;
  mealsPerDay: number;
}

export interface AccountResponse {
  user: AuthUser;
  profile: BackendProfile | null;
  goals: {
    method: string;
    daily: Record<NutrientKey, { value: number | null }>;
    perMeal: Record<NutrientKey, { value: number | null }>;
  } | null;
}

export async function getAccount(): Promise<AccountResponse | null> {
  try {
    return await apiFetch<AccountResponse>('/users/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function toBackendProfile(profile: Profile) {
  return {
    sex: profile.gender === 'female' ? 'FEMALE' : 'MALE',
    age: Number(profile.age), heightCm: Number(profile.height),
    weightKg: Number(profile.weight), mealsPerDay: Number(profile.mealsPerDay),
  };
}

export function toUiProfile(profile: BackendProfile): Profile {
  return { nickname: profile.nickname, gender: profile.sex === 'FEMALE' ? 'female' : 'male',
    age: profile.age, height: profile.heightCm, weight: profile.weightKg,
    mealsPerDay: profile.mealsPerDay };
}

export function toUiGoals(values: Record<NutrientKey, { value: number | null }>): Goals {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.value])) as Goals;
}

export function saveAccountProfile(profile: Profile): Promise<AccountResponse> {
  return apiFetch('/users/me/profile', { method: 'PUT', body: JSON.stringify({
    ...toBackendProfile(profile), nickname: profile.nickname?.trim() || '든든 사용자',
  }) });
}

export function getAuthConfig(): Promise<{ googleEnabled: boolean; consentVersion: string }> {
  return apiFetch('/auth/config');
}

export function startGoogleLogin() {
  window.location.assign(`${API_BASE_URL}/auth/google/login?consent=true`);
}

export function logoutAccount(): Promise<null> {
  return apiFetch('/auth/logout', { method: 'POST' });
}
