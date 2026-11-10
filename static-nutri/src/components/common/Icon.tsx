import type { CSSProperties } from 'react';

type IconName = 'settings' | 'back' | 'chevron' | 'plus' | 'check' | 'info' | 'bowl';
const paths: Record<IconName, string> = {
  settings: 'M9.5 3.5 10 1.8h4l.5 1.7 1.8 1 1.7-.4 2 3.5-1.2 1.3v2.2l1.2 1.3-2 3.5-1.7-.4-1.8 1-.5 1.7h-4l-.5-1.7-1.8-1-1.7.4-2-3.5 1.2-1.3V8.9L4 7.6l2-3.5 1.7.4 1.8-1Z M15 10.6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  back: 'M14 5 7 12l7 7',
  chevron: 'm9 5 7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  check: 'm5 12 4 4L19 6',
  info: 'M12 8v.01M12 11v6M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  bowl: 'M3 11h18c0 5-3 9-9 9s-9-4-9-9ZM7 7l2-3m3 3 2-4m3 5 2-3',
};

export default function Icon({ name, size = 22, style }: {
  name: IconName; size?: number; style?: CSSProperties;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
    <path d={paths[name]} />
  </svg>;
}

export function GoogleMark() {
  return <svg width="23" height="23" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.7h11a9.5 9.5 0 0 1-4.1 6.3v5.2h6.7c3.9-3.6 6-8.9 6-15.2Z" />
    <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2a12.2 12.2 0 0 1-18.1-6.4H5.8v5.4A20.4 20.4 0 0 0 24 44Z" />
    <path fill="#FBBC05" d="M12.7 27.5a12 12 0 0 1 0-7V15H5.8a20.4 20.4 0 0 0 0 18l6.9-5.5Z" />
    <path fill="#EA4335" d="M24 12a11 11 0 0 1 7.8 3l5.9-5.8A19.8 19.8 0 0 0 24 4 20.4 20.4 0 0 0 5.8 15l6.9 5.5A12.1 12.1 0 0 1 24 12Z" />
  </svg>;
}
