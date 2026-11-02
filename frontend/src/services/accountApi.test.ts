import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './apiClient';
import { getAccount, toBackendProfile } from './accountApi';

afterEach(() => { vi.unstubAllGlobals(); });

describe('회원 API', () => {
  it('토큰을 localStorage에서 꺼내지 않고 세션 쿠키를 전달한다', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);
    await apiFetch('/users/me');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/v1/users/me');
    expect(options.credentials).toBe('include');
    expect(options.headers.has('Authorization')).toBe(false);
  });

  it('401만 비로그인으로 처리하고 서버 오류는 호출자에게 알린다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    expect(await getAccount()).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'DB 연결 오류' }), { status: 500 })));
    await expect(getAccount()).rejects.toThrow('DB 연결 오류');
  });

  it('화면 프로필을 백엔드 JSON 키로 변환한다', () => {
    expect(toBackendProfile({ gender: 'female', age: 14, height: 160, weight: 50, mealsPerDay: 3 }))
      .toEqual({ sex: 'FEMALE', age: 14, heightCm: 160, weightKg: 50, mealsPerDay: 3 });
  });
});
