import { useState } from 'react';
import Button from '../common/Button';
import Icon, { GoogleMark } from '../common/Icon';
import { useApp } from '../../hooks/useApp';

export default function SettingsScreen() {
  const { user, profile, editProfile, beginEntry, googleEnabled, setStage, logout } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nickname = user?.nickname || profile?.nickname || '게스트';

  async function handleLogout() {
    setBusy(true);
    setError('');
    try { await logout(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '로그아웃하지 못했어요.'); }
    finally { setBusy(false); }
  }

  const rows = [
    ['닉네임', nickname], ['키', profile ? `${profile.height} cm` : '입력 전'],
    ['몸무게', profile ? `${profile.weight} kg` : '입력 전'],
    ['하루 식사', profile ? `${profile.mealsPerDay}끼` : '입력 전'],
  ];

  return <section className="settings-screen" aria-label="계정과 앱 설정">
    <div className="settings-account">
      <div className="account-avatar" aria-hidden="true">{nickname.slice(0, 1)}</div>
      <div><h2>{nickname}</h2><p>{user ? '구글 계정으로 로그인 중' : '게스트로 이용 중'}</p>
        {!user && <span>기록은 현재 브라우저에 저장돼요</span>}</div>
    </div>

    <section aria-labelledby="profile-settings-title" className="settings-section">
      <div className="section-title"><h2 id="profile-settings-title">내 프로필</h2>
        <button className="text-action" onClick={editProfile}>{profile ? '수정' : '입력'}</button></div>
      <div className="settings-list">{rows.map(([label, value]) =>
        <button className="settings-row" key={label} onClick={editProfile}>
          <span>{label}</span><span className="settings-value">{value}</span><Icon name="chevron" size={17} />
        </button>)}</div>
      {profile && <p className="section-note">{profile.age}세 / {profile.gender === 'female' ? '여자' : '남자'} 기준으로 영양 목표를 계산해요</p>}
    </section>

    <section aria-labelledby="records-settings-title" className="settings-section">
      <div className="section-title"><h2 id="records-settings-title">기록과 정보</h2></div>
      <div className="settings-list">
        <button className="settings-row" disabled={!profile} onClick={() => setStage('dailySummary')}>
          <span>저장한 식사 기록</span><Icon name="chevron" size={17} /></button>
        {profile && <button className="settings-row" onClick={() => setStage('goals')}>
          <span>내 영양 목표</span><Icon name="chevron" size={17} /></button>}
        <details className="settings-details"><summary className="settings-row"><span>영양 데이터 출처</span><Icon name="chevron" size={17} /></summary>
          <div className="settings-detail-copy"><p>농촌진흥청 국가표준식품성분 DB를 바탕으로 상품의 영양값을 연결해요. 식약처에서 확인한 성분이 있으면 해당 값을 우선해요.</p>
            <p>2025 한국인 영양소 섭취기준과 소아청소년 에너지필요추정량 연구를 참고해 목표를 계산해요. 추정값과 미확인 값은 결과에서 구분해요.</p></div>
        </details>
        <details className="settings-details"><summary className="settings-row"><span>서비스 정보</span><Icon name="chevron" size={17} /></summary>
          <div className="settings-detail-copy"><p>든든은 편의점에서 고른 음식의 영양을 확인하고, 한 끼를 보완할 식품을 찾도록 돕는 서비스예요.</p>
            <p>2026 국가표준식품성분 DB 활용 아이디어 공모전 출품작입니다.</p></div>
        </details>
      </div>
    </section>

    {error && <p className="inline-notice notice-error" role="alert">{error}</p>}
    <div className="settings-bottom">{user
      ? <Button variant="secondary" fullWidth disabled={busy} onClick={handleLogout}>{busy ? '로그아웃 중…' : '로그아웃'}</Button>
      : <><button className="google-login-button" disabled={!googleEnabled} onClick={() => beginEntry('google')}><GoogleMark />구글 계정으로 로그인</button>
        <p className="section-note">로그인하면 다른 기기에서도 기록을 확인할 수 있어요</p></>}
    </div>
  </section>;
}
