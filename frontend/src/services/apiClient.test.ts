import { describe, expect, it } from 'vitest';

import { resolveErrorMessage } from './apiClient';

describe('API 오류 메시지 변환', () => {
  it('message 문자열이 있으면 그대로 쓴다', () => {
    expect(resolveErrorMessage({ message: '몸무게 값을 다시 확인해 주세요.' })).toBe('몸무게 값을 다시 확인해 주세요.');
  });

  it('detail 문자열도 메시지로 쓴다', () => {
    expect(resolveErrorMessage({ detail: '등록된 상품을 찾을 수 없습니다.' })).toBe('등록된 상품을 찾을 수 없습니다.');
  });

  it('FastAPI 기본 422 배열은 필드와 원인으로 풀어 쓴다', () => {
    const body = {
      detail: [
        { loc: ['body', 'profile', 'weightKg'], msg: 'Input should be greater than 20' },
        { loc: ['body', 'items'], msg: 'List should have at most 30 items' },
      ],
    };
    expect(resolveErrorMessage(body)).toBe(
      'profile.weightKg: Input should be greater than 20\nitems: List should have at most 30 items',
    );
    expect(resolveErrorMessage(body)).not.toContain('[object Object]');
  });

  it('본문이 없거나 형식이 다르면 기본 문구를 쓴다', () => {
    expect(resolveErrorMessage(null)).toBe('요청을 처리하지 못했어요.');
    expect(resolveErrorMessage({ detail: { code: 1 } })).toBe('요청을 처리하지 못했어요.');
  });
});
