import { useEffect, useMemo, useRef } from 'react';
import Button from '../common/Button';
import { EmptyState, ScreenShell } from '../common/Card';
import Icon from '../common/Icon';
import { useApp } from '../../hooks/useApp';
import { evaluateNutrients } from '../../utils/nutrition';
import { AnalysisSwitch, EnergySummary, NutrientOverview } from './NutritionOverview';

export default function DailySummaryScreen() {
  const { user, dailyTotals, dailyGoals, dailyMeals, setStage, dailyAnalysis,
    dailyIsPartial, dailyError, dailyLoading, refreshDaily, dateKey } = useApp();

  const initialDate = useRef(dateKey);
  useEffect(() => { void refreshDaily(initialDate.current); }, [refreshDaily]);
  const evaluation = useMemo(() => user ? dailyAnalysis
    : dailyTotals && dailyGoals ? evaluateNutrients(dailyTotals, dailyGoals) : null,
  [user, dailyAnalysis, dailyTotals, dailyGoals]);

  return <ScreenShell title="하루 식사 기록" subtitle={user ? '저장한 기록을 날짜별로 확인해요' : '이 브라우저에 저장한 게스트 기록이에요'}>
    <AnalysisSwitch period="day" />
    <div className="record-date-field"><label htmlFor="record-date">기록 날짜</label>
      <input id="record-date" type="date" value={dateKey} onChange={(event) => {
        if (event.target.value) void refreshDaily(event.target.value);
      }} /></div>

    {dailyLoading ? <div className="loading-state" role="status"><span className="loading-dot" />기록을 불러오고 있어요</div>
      : dailyError ? <><p className="inline-notice notice-error" role="alert">{dailyError}</p>
        <Button onClick={() => { void refreshDaily(dateKey); }}>다시 불러오기</Button></>
      : !dailyMeals.length || !evaluation ? <EmptyState icon="🍽️" title="해당 날짜의 기록이 없어요" description="저장한 식사가 이곳에 모여요" />
      : <>
        <div className="day-record-note"><span>저장한 식사 <b>{dailyMeals.length}건</b></span>
          {dailyIsPartial && <span className="quality-chip">일부 식사 기록</span>}</div>
        <EnergySummary evaluation={evaluation} period="day" />
        <NutrientOverview evaluation={evaluation} period="day" />
        <section aria-labelledby="recorded-meals-title"><div className="section-title"><h2 id="recorded-meals-title">저장한 식사</h2></div>
          <div className="saved-meal-list">{dailyMeals.map((meal) => <details className="saved-meal-card" key={meal.clientMealId}>
            <summary><div><span className="saved-meal-time">{new Date(meal.confirmedAt).toLocaleTimeString('ko-KR', {
              timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit',
            })}</span><h3>{meal.items.map((item) => item.name).join(', ')}</h3></div><Icon name="chevron" size={18} /></summary>
            <div className="saved-meal-body">{meal.analysis ? <><EnergySummary evaluation={meal.analysis.evaluation} />
              <NutrientOverview evaluation={meal.analysis.evaluation} /></>
              : <ul>{meal.items.map((item, index) => <li key={`${item.foodId}-${index}`}>{item.name} / {item.qty}회</li>)}</ul>}</div>
          </details>)}</div>
        </section>
      </>}
    <Button size="lg" fullWidth onClick={() => setStage('search')}>새 식사 입력하기</Button>
  </ScreenShell>;
}
