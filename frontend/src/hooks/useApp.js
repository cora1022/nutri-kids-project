import { useContext } from 'react';
import { AppContext } from '../context/appContextObject';

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp은 AppProvider 안에서만 사용할 수 있어요');
  return ctx;
}
