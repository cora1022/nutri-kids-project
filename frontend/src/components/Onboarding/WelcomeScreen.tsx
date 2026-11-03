import Button from '../common/Button';
import { GoogleMark } from '../common/Icon';
import { useApp } from '../../hooks/useApp';

export default function WelcomeScreen() {
  const { beginEntry, googleEnabled } = useApp();
  const failedLogin = new URLSearchParams(window.location.search).has('authError');
  return <section className="entry-screen" aria-labelledby="entry-title">
    <div className="entry-hero"><img src="/logo.png" alt="든든의 초록 식사 그릇" width="200" height="200" /></div>
    <div className="entry-copy">
      <h1 id="entry-title">오늘 한 끼,<br /><span>든든하게</span> 시작해요</h1>
      <p>나에게 맞는 영양을 확인해요</p>
    </div>
    {failedLogin && <p className="inline-notice notice-error" role="alert">구글 로그인을 완료하지 못했어요. 다시 시도해 주세요.</p>}
    <div className="entry-actions">
      <button className="google-login-button" disabled={!googleEnabled} onClick={() => beginEntry('google')}>
        <GoogleMark />구글 계정으로 로그인
      </button>
      <Button size="lg" fullWidth onClick={() => beginEntry('guest')}>게스트로 시작하기</Button>
      <p className="entry-note">{googleEnabled ? '로그인하면 식사 기록이 저장돼요' : '구글 로그인은 준비 중이에요'}<br />
        게스트 기록은 이 기기에만 남아요</p>
    </div>
  </section>;
}
