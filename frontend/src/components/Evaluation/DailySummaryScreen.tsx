import { useEffect, useMemo } from 'react';
import Button from '../common/Button';
import { Card, ScreenShell } from '../common/Card';
import NutrientBar from '../common/NutrientBar';
import { useApp } from '../../hooks/useApp';
import { NUTRIENT_META } from '../../data/goals';
import { evaluateNutrients } from '../../utils/nutrition';

export default function DailySummaryScreen() {
  const { user, dailyTotals, dailyGoals, dailyMeals, setStage, dailyAnalysis,
    dailyIsPartial, dailyError, dailyLoading, refreshDaily, dateKey } = useApp();
  useEffect(() => { void refreshDaily(); }, [refreshDaily]);
  const evaluation = useMemo(() => user ? dailyAnalysis : dailyTotals && dailyGoals ? evaluateNutrients(dailyTotals, dailyGoals) : null,
    [user, dailyAnalysis, dailyTotals, dailyGoals]);
  return <ScreenShell eyebrow="하루 평가" title={`${dateKey} 식사 기록`} subtitle={`${dailyMeals.length}건${dailyIsPartial ? ' / 일부 식사 기록' : ''}`}>
    <div className="field"><label htmlFor="record-date">기록 날짜 (한국 시간)</label>
      <input id="record-date" type="date" value={dateKey} onChange={(event) => { if (event.target.value) void refreshDaily(event.target.value); }} /></div>
    {dailyLoading ? <p role="status">기록을 불러오고 있어요.</p> : dailyError ? <><p role="alert">{dailyError}</p>
      <Button onClick={() => { void refreshDaily(dateKey); }}>다시 불러오기</Button></>
      : dailyMeals.length && evaluation ? <>
        <div className="nutrient-bar-list">{NUTRIENT_META.map(({ key, label, unit, kind }) =>
          <NutrientBar key={key} label={label} unit={unit} kind={kind} evalItem={evaluation[key]} />)}</div>
        <Card tone="muted"><h3>저장한 식사</h3><ul className="daily-meal-list">{dailyMeals.map((meal) =>
          <li key={meal.clientMealId}>{meal.items.map((item) => item.name).join(', ')}</li>)}</ul></Card>
      </> : <p>해당 날짜의 기록이 없어요.</p>}
    <Button fullWidth onClick={() => setStage('search')}>새 식사 입력하기</Button>
  </ScreenShell>;
}
