import { useEffect, useRef } from 'react';
import { AppProvider } from './context/AppContext';
import { useApp } from './hooks/useApp';
import WelcomeScreen from './components/Onboarding/WelcomeScreen';
import ConsentScreen from './components/Onboarding/ConsentScreen';
import ProfileForm from './components/Onboarding/ProfileForm';
import GoalsSummary from './components/Onboarding/GoalsSummary';
import SearchScreen from './components/FoodLog/SearchScreen';
import MealResultScreen from './components/Evaluation/MealResultScreen';
import DailySummaryScreen from './components/Evaluation/DailySummaryScreen';
import SettingsScreen from './components/Settings/SettingsScreen';
import Icon from './components/common/Icon';
import './App.css';
import './redesign.css';

function Stage() {
  const { stage, authReady, authError } = useApp();
  if (!authReady) return <div className="loading-state" role="status"><span className="loading-dot" />회원 정보를 확인하고 있어요</div>;
  if (authError) return <div className="screen" role="alert"><h1>연결을 확인해 주세요</h1><p>{authError}</p>
    <button className="btn btn-primary btn-lg" onClick={() => window.location.reload()}>다시 연결하기</button></div>;
  switch (stage) {
    case 'welcome': return <WelcomeScreen />;
    case 'consent': return <ConsentScreen />;
    case 'profile': return <ProfileForm />;
    case 'goals': return <GoalsSummary />;
    case 'search': return <SearchScreen />;
    case 'evaluate': return <MealResultScreen />;
    case 'dailySummary': return <DailySummaryScreen />;
    case 'settings': return <SettingsScreen />;
  }
}

function AppLayout() {
  const { stage, authReady, openSettings, closeSettings } = useApp();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    main.current?.focus({ preventScroll: true });
    document.title = `${stage === 'settings' ? '설정' : stage === 'evaluate' ? '한 끼 분석' : stage === 'dailySummary' ? '식사 기록' : '오늘 한 끼, 든든하게'} | 든든`;
  }, [stage]);
  const settings = stage === 'settings';
  return <div className="app-outer"><div className={`app-shell app-stage-${stage}`}>
    <header className="top-bar">
      {settings ? <>
        <button className="icon-button" aria-label="이전 화면으로" onClick={closeSettings}><Icon name="back" /></button>
        <h1 className="settings-header-title">설정</h1>
      </> : <div className="top-bar-brand"><img src={`${import.meta.env.BASE_URL}logo-64.png`} alt="" className="top-bar-mark" width="38" height="38" /><span className="top-bar-name">든든</span></div>}
      <button className="icon-button settings-trigger" aria-label="설정" aria-current={settings ? 'page' : undefined}
        onClick={openSettings} disabled={!authReady || settings}><Icon name="settings" size={25} /></button>
    </header>
    <main ref={main} tabIndex={-1} className="app-main"><Stage /></main>
    <footer className="data-source">자료 출처: 농촌진흥청 국가표준식품성분 DB</footer>
  </div></div>;
}

export default function App() {
  return <AppProvider><AppLayout /></AppProvider>;
}
