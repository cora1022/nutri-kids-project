import Button from '../common/Button';
import { loadProfile } from '../../utils/storage';
import { useApp } from '../../hooks/useApp';

export default function WelcomeScreen() {
  const { setStage } = useApp();

  function handleStart() {
    const existing = loadProfile();
    // 기존 회원(저장된 프로필 있음)은 동의·입력 단계를 건너뛰고 바로 목표 계산으로
    setStage(existing ? 'goals' : 'consent');
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-badge">든든</div>
      <h1>오늘 한 끼, 균형 잡게 도와줄게요</h1>
      <p className="welcome-copy">
        편의점에서 산 음식도 괜찮아요. 무엇을 먹었는지 알려주면
        부족한 영양소를 확인하고 다음에 뭘 곁들이면 좋을지 알려드려요.
      </p>
      <Button size="lg" fullWidth onClick={handleStart}>
        시작하기
      </Button>
    </div>
  );
}
