import Button from '../common/Button';
import { Card, ScreenShell } from '../common/Card';
import { NUTRIENT_META } from '../../data/goals';
import { useApp } from '../../hooks/useApp';

export default function GoalsSummary() {
  const { dailyGoals, mealGoals, profile, setStage } = useApp();

  return (
    <ScreenShell
      eyebrow="01 가입 · 목표 설정"
      title="오늘의 목표를 계산했어요"
      subtitle={`${profile.age}세 · ${profile.gender === 'female' ? '여자' : '남자'} 기준, 하루 ${profile.mealsPerDay}끼로 배분`}
    >
      <Card tone="muted">
        <div className="goals-grid">
          {NUTRIENT_META.map(({ key, label, unit, kind }) => (
            <div key={key} className="goal-row">
              <span className="goal-label">{label}</span>
              <span className="goal-values">
                <b>{Math.round(mealGoals[key])}{unit}</b>
                <em>/ 한 끼</em>
                <span className="goal-daily">
                  (하루 {kind === 'upperLimit' ? '상한' : '목표'} {Math.round(dailyGoals[key])}{unit})
                </span>
              </span>
            </div>
          ))}
        </div>
      </Card>
      <p className="fine-print">
        나트륨은 “상한”이라 이 값을 넘지 않는 게 목표예요. 나머지는 이 값에 가까울수록 좋아요.
      </p>
      <Button size="lg" fullWidth onClick={() => setStage('search')}>
        오늘 먹은 음식 입력하러 가기
      </Button>
      <Button variant="ghost" fullWidth onClick={() => setStage('profile')}>
        내 정보 다시 수정하기
      </Button>
    </ScreenShell>
  );
}
