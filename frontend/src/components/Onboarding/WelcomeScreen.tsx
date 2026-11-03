import Button from '../common/Button';
import { useApp } from '../../hooks/useApp';

export default function WelcomeScreen() {
  const { setStage, profile, googleEnabled } = useApp();

  function handleStart() {
    setStage(profile ? 'goals' : 'consent');
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-illustration" aria-hidden="true">🍙🥛🍎</div>
      <div className="welcome-badge">든든</div>
      <h1>오늘 한 끼, 균형 잡게 도와줄게요</h1>
      <p className="welcome-copy">
        편의점에서 산 음식도 괜찮아요. 무엇을 먹었는지 알려주면
        부족한 영양소를 확인하고 다음에 뭘 곁들이면 좋을지 알려드려요.
      </p>
      <div className="welcome-tags">
        <span className="welcome-tag">🏪 편의점 상품 검색</span>
        <span className="welcome-tag">📊 영양 한눈에 확인</span>
        <span className="welcome-tag">🍽️ 부족한 영양 추천</span>
      </div>
      <Button size="lg" fullWidth onClick={handleStart}>
        시작하기
      </Button>
      <p className="muted-line">{googleEnabled ? '구글 계정으로 로그인하면 다른 기기에서도 기록을 확인할 수 있어요.' : '체험 기록은 이 브라우저에 저장돼요.'}</p>
    </div>
  );
}
