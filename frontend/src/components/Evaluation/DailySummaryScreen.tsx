import { useMemo } from 'react';
import Button from '../common/Button';
import { Card, ScreenShell } from '../common/Card';
import NutrientBar from '../common/NutrientBar';
import { useApp } from '../../hooks/useApp';
import { NUTRIENT_META } from '../../data/goals';
import { evaluateNutrients } from '../../utils/nutrition';

export default function DailySummaryScreen() {
  const { dailyTotals, dailyGoals, dailyMeals, setStage } = useApp();

  const evaluation = useMemo(
    () => (dailyTotals && dailyGoals ? evaluateNutrients(dailyTotals, dailyGoals) : null),
    [dailyTotals, dailyGoals]
  );

  if (!dailyTotals || !evaluation) {
    return (
      <ScreenShell eyebrow="하루 평가" title="오늘 기록이 없어요">
        <Button onClick={() => setStage('search')}>음식 입력하러 가기</Button>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="하루 평가"
      title="오늘 하루 잘 챙겨 먹었어요!"
      subtitle={`오늘 기록한 식사 ${dailyMeals.length}끼 기준`}
    >
      <div className="nutrient-bar-list">
        {NUTRIENT_META.map(({ key, label, unit, kind }) => (
          <NutrientBar key={key} label={label} unit={unit} kind={kind} evalItem={evaluation[key]} />
        ))}
      </div>

      <Card tone="muted">
        <h3>오늘 기록한 식사</h3>
        <ul className="daily-meal-list">
          {dailyMeals.map((m) => (
            <li key={m.clientMealId}>
              {m.items.map((it) => it.name).join(', ')}
            </li>
          ))}
        </ul>
      </Card>

      <Button size="lg" fullWidth onClick={() => setStage('search')}>
        새 식사 더 기록하기
      </Button>
    </ScreenShell>
  );
}
