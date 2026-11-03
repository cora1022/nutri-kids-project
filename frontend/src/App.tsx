import { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { useApp } from './hooks/useApp';
import SplashScreen from './components/common/SplashScreen';
import WelcomeScreen from './components/Onboarding/WelcomeScreen';
import ConsentScreen from './components/Onboarding/ConsentScreen';
import ProfileForm from './components/Onboarding/ProfileForm';
import GoalsSummary from './components/Onboarding/GoalsSummary';
import SearchScreen from './components/FoodLog/SearchScreen';
import MealResultScreen from './components/Evaluation/MealResultScreen';
import DailySummaryScreen from './components/Evaluation/DailySummaryScreen';
import './App.css';

function Stage() {
  const { stage, authReady, authError } = useApp();
  if (!authReady) return <p role="status">회원 정보를 확인하고 있어요.</p>;
  if (authError) return <div role="alert"><p>{authError}</p>
    <button onClick={() => window.location.reload()}>다시 연결하기</button></div>;
  switch (stage) {
    case 'welcome':
      return <WelcomeScreen />;
    case 'consent':
      return <ConsentScreen />;
    case 'profile':
      return <ProfileForm />;
    case 'goals':
      return <GoalsSummary />;
    case 'search':
      return <SearchScreen />;
    case 'evaluate':
      return <MealResultScreen />;
    case 'dailySummary':
      return <DailySummaryScreen />;
    default:
      return <WelcomeScreen />;
  }
}

function TopBar() {
  const { user, profile, logout, setStage, googleEnabled } = useApp();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function handleLogout() {
    setBusy(true);
    try { await logout(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '로그아웃하지 못했어요.'); }
    finally { setBusy(false); }
  }
  return <div className="top-bar">
    <div className="top-bar-brand"><img src="/logo.png" alt="든든" className="top-bar-mark" />
      <div><div className="top-bar-name">든든</div><div className="top-bar-tag">오늘 한 끼, 균형 잡게</div></div></div>
    <div className="account-actions">{user ? <>
      <span>{user.nickname}님{profile ? ` / ${profile.height}cm, ${profile.weight}kg` : ''}</span>
      <button onClick={() => setStage('profile')}>내 정보</button>
      {profile && <button onClick={() => setStage('dailySummary')}>내 기록</button>}
      <button disabled={busy} onClick={handleLogout}>로그아웃</button>
    </> : googleEnabled && <button onClick={() => setStage('consent')}>구글 로그인</button>}
    {error && <p role="alert">{error}</p>}</div>
  </div>;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <AppProvider>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <div className="app-outer">
        <div className="app-shell">
          <TopBar />
          <Stage />
          <footer className="data-source">자료 출처: 농촌진흥청 국가표준식품성분</footer>
        </div>
      </div>
    </AppProvider>
  );
}
