import { useState } from 'react';
import Button from '../common/Button';
import { ScreenShell } from '../common/Card';
import { useApp } from '../../hooks/useApp';

export default function ConsentScreen() {
  const { setStage, googleEnabled, startGoogleLogin, entryMode } = useApp();
  const [checked, setChecked] = useState(false);
  const [declined, setDeclined] = useState(false);

  if (declined) {
    return (
      <ScreenShell eyebrow="가입과 목표 설정" title="가입을 진행할 수 없어요">
        <p className="body-text">
          서비스 이용을 위해서는 성별, 키, 몸무게, 나이 정보 이용에 동의가 필요해요.
          마음이 바뀌면 언제든 다시 시작할 수 있어요.
        </p>
        <Button variant="secondary" onClick={() => setDeclined(false)}>
          다시 확인하기
        </Button>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell eyebrow="가입과 목표 설정" title="시작 전에 확인할게요">
      <div className="consent-box">
        <p>
          맞춤 목표를 계산하려면 <strong>성별, 키, 몸무게, 나이</strong> 정보가 필요해요.
          구글 로그인 시 이메일과 이름을 받아 회원을 구분하고, 프로필과 확정한 식사 기록을 서버에 저장해요.
          성별, 키, 몸무게, 나이는 영양 목표 계산에 사용해요. 체험만 하면 이 브라우저에 저장돼요.
        </p>
        <label className="consent-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>위 내용에 동의해요</span>
        </label>
      </div>
      <div className="button-row">
        <Button variant="ghost" onClick={() => setDeclined(true)}>
          동의하지 않음
        </Button>
      </div>
      {entryMode === 'google' ? <Button size="lg" fullWidth disabled={!checked || !googleEnabled} onClick={startGoogleLogin}>
        동의하고 구글로 계속하기</Button> : <Button size="lg" fullWidth disabled={!checked} onClick={() => setStage('profile')}>
        동의하고 게스트로 시작하기</Button>}
      <Button variant="ghost" onClick={() => setStage('welcome')}>처음 화면으로 돌아가기</Button>
    </ScreenShell>
  );
}
