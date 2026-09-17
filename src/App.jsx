import { AppProvider } from './context/AppContext';
import { useApp } from './hooks/useApp';
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
        <span className="top-bar-mark" aria-hidden="true">🍙</span>
        <div>
          <div className="top-bar-name">든든</div>
          <div className="top-bar-tag">오늘 한 끼, 균형 잡게</div>
        </div>
      </div>
      <span className="top-bar-chip">편의점 밥도 OK 👍</span>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <div className="app-outer">
        <div className="app-shell">
          <TopBar />
          <Stage />
        </div>
      </div>
    </AppProvider>
  );
}
