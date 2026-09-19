import { useContext } from 'react';
import { AppContext } from '../context/appContextObject';
import type { AppContextValue } from '../types';

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp은 AppProvider 안에서만 사용할 수 있어요');
  return ctx;
}
