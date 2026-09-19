import { useState } from 'react';
import Button from '../common/Button';
import { ScreenShell } from '../common/Card';
import { useApp } from '../../hooks/useApp';

export default function ConsentScreen() {
  const { setStage } = useApp();
  const [checked, setChecked] = useState(false);
  const [declined, setDeclined] = useState(false);

  if (declined) {
    return (
      <ScreenShell eyebrow="01 가입 · 목표 설정" title="가입을 진행할 수 없어요">
        <p className="body-text">
          서비스 이용을 위해서는 최소한의 개인정보(성별·키·몸무게·나이) 동의가 필요해요.
          마음이 바뀌면 언제든 다시 시작할 수 있어요.
        </p>
        <Button variant="secondary" onClick={() => setDeclined(false)}>
          다시 확인하기
        </Button>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell eyebrow="01 가입 · 목표 설정" title="시작 전에 확인할게요">
      <div className="consent-box">
        <p>
          맞춤 목표를 계산하려면 <strong>성별, 키, 몸무게, 나이</strong> 정보가 필요해요.
          입력한 정보는 목표 계산 용도로만 사용돼요.
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
        <Button disabled={!checked} onClick={() => setStage('profile')}>
          동의하고 계속하기
        </Button>
      </div>
    </ScreenShell>
  );
}
