import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

const VISIBLE_MS = 1300;
const FADE_MS = 450;

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), VISIBLE_MS);
    const doneTimer = setTimeout(onFinish, VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div className={`splash-screen ${fading ? 'splash-fade-out' : ''}`} role="presentation">
      <div className="splash-logo-wrap">
        <img src="/logo.png" alt="든든" className="splash-logo" />
      </div>
      <div className="splash-name">든든</div>
      <div className="splash-tag">오늘 한 끼, 균형 잡게</div>
    </div>
  );
}
