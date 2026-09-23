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
  const { stage } = useApp();
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
  return (
    <div className="top-bar">
      <div className="top-bar-brand">
        <img src="/logo.png" alt="든든" className="top-bar-mark" />
        <div>
          <div className="top-bar-name">든든</div>
          <div className="top-bar-tag">오늘 한 끼, 균형 잡게</div>
        </div>
      </div>
    </div>
  );
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
