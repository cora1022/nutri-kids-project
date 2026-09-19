import Button from '../common/Button';
import { Card, ScreenShell } from '../common/Card';
import { NUTRIENT_META } from '../../data/goals';
import { useApp } from '../../hooks/useApp';

export default function GoalsSummary() {
  const { dailyGoals, mealGoals, profile, setStage } = useApp();

  if (!dailyGoals || !mealGoals || !profile) {
    return (
      <ScreenShell eyebrow="01 가입 및 목표 설정" title="정보를 먼저 입력해 주세요">
        <Button onClick={() => setStage('profile')}>정보 입력하러 가기</Button>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="01 가입 및 목표 설정"
      title="오늘의 목표를 계산했어요"
      subtitle={`${profile.age}세, ${profile.gender === 'female' ? '여자' : '남자'} 기준, 하루 ${profile.mealsPerDay}끼로 배분`}
    >
      <Card tone="muted">
        <div className="goals-grid">
          {NUTRIENT_META.map(({ key, label, unit, kind }) => (
            <div key={key} className="goal-row">
              <span className="goal-label">{label}</span>
              <span className="goal-values">
                {mealGoals[key] === null ? (
                  <b>평가 기준 미설정</b>
                ) : (
                  <>
                    <b>{Math.round(mealGoals[key])}{unit}</b>
                    <em>/ 한 끼</em>
                    <span className="goal-daily">
                      (하루 {kind === 'adequateIntake' ? '충분섭취량' : '목표'}{' '}
                      {Math.round(dailyGoals[key] as number)}{unit})
                    </span>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </Card>
      <p className="fine-print">
        열량은 나이, 성별, 키, 몸무게와 저활동 기준으로 계산했어요. 탄수화물은 권장 범위의
        중간값이며, 한 끼 수치는 하루 기준을 식사 횟수로 균등하게 나눈 서비스용 목표예요.
        현재 근거 범위에서 제외한 철분과 나트륨은 임의의 수치를 표시하지 않아요.
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
