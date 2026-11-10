import type { AuthUser, Goals, NutrientKey, Profile } from '../types';

// 정적 배포본은 회원 서버 없이 동작합니다. 로그인 버튼은 화면에 남기고,
// 누르면 지원하지 않는다는 안내만 보여 줍니다. 모든 이용자는 게스트로 처리합니다.
export const LOGIN_UNAVAILABLE_MESSAGE = '지금은 구글 로그인을 지원하지 않아요.\n게스트로 시작하면 기록이 이 기기에 저장돼요.';

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
  return null;
}

export function toBackendProfile(profile: Profile) {
  return {
    sex: profile.gender === 'female' ? 'FEMALE' as const : 'MALE' as const,
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

export async function saveAccountProfile(profile: Profile): Promise<AccountResponse> {
  void profile;
  throw new Error(LOGIN_UNAVAILABLE_MESSAGE);
}

// 로그인 버튼을 서버 버전과 같은 모양으로 보이도록 활성 상태를 유지합니다.
export async function getAuthConfig(): Promise<{ googleEnabled: boolean; consentVersion: string }> {
  return { googleEnabled: true, consentVersion: 'static' };
}

export function startGoogleLogin() {
  window.alert(LOGIN_UNAVAILABLE_MESSAGE);
}

export async function logoutAccount(): Promise<null> {
  return null;
}
