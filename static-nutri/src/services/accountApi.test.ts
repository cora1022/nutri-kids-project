import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccount, getAuthConfig, startGoogleLogin, toBackendProfile } from './accountApi';

afterEach(() => { vi.unstubAllGlobals(); });

describe('정적 버전 회원 API', () => {
  it('서버를 호출하지 않고 항상 게스트로 처리한다', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await getAccount()).toBeNull();
    expect((await getAuthConfig()).googleEnabled).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('로그인 버튼은 이동하지 않고 안내만 보여 준다', () => {
    const alert = vi.fn();
    vi.stubGlobal('window', { alert, location: { assign: vi.fn() } });
    startGoogleLogin();
    expect(alert).toHaveBeenCalledOnce();
  });

  it('화면 프로필을 백엔드 JSON 키로 변환한다', () => {
    expect(toBackendProfile({ gender: 'female', age: 14, height: 160, weight: 50, mealsPerDay: 3 }))
      .toEqual({ sex: 'FEMALE', age: 14, heightCm: 160, weightKg: 50, mealsPerDay: 3 });
  });
});
