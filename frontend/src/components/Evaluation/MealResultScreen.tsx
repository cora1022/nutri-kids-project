import { useEffect, useState } from 'react';
import Button from '../common/Button';
import { EmptyState, ScreenShell } from '../common/Card';
import Icon from '../common/Icon';
import { useApp } from '../../hooks/useApp';
import { NUTRIENT_META } from '../../data/goals';
import { analyzeMeal } from '../../services/mealApi';
import { mealDateLabel } from '../../utils/resultPresentation';
import { AnalysisSwitch, EnergySummary, NutrientOverview } from './NutritionOverview';
import type { Food, MealAnalysis } from '../../types';

function ProductThumbnail({ food }: { food: Food }) {
  const [failed, setFailed] = useState(false);
  return <div className="recommend-thumbnail">{food.imageUrl && !failed
    ? <img src={food.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <Icon name="bowl" size={30} />}</div>;
}

export default function MealResultScreen() {
  const { mealItems, profile, setStage, confirmMeal, addFoodToMeal, lastConfirmedMeal, user } = useApp();
  const [state, setState] = useState<{ signature: string; result?: MealAnalysis; error?: string } | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [retry, setRetry] = useState(0);
  const [openedAt] = useState(() => new Date());
  const signature = JSON.stringify([profile, mealItems.map(({ food, qty }) => [food.id, qty])]);
  const saved = mealItems.length === 0 ? lastConfirmedMeal : null;

  useEffect(() => {
    if (!mealItems.length || !profile) return;
    let active = true;
    analyzeMeal(profile, mealItems)
      .then((result) => { if (active) setState({ signature, result }); })
      .catch((error: Error) => { if (active) setState({ signature, error: error.message }); });
    return () => { active = false; };
  }, [mealItems, profile, signature, retry]);

  const analysis = saved?.analysis ?? (state?.signature === signature ? state.result : undefined);
  const analysisError = !saved && state?.signature === signature ? state.error : null;

  async function handleConfirm() {
    if (saveState === 'saving' || !analysis) return;
    setSaveState('saving');
    setSaveError('');
    try { await confirmMeal(analysis); setSaveState('idle'); }
    catch (error) {
      setSaveState('error');
      setSaveError(error instanceof Error ? error.message : '저장하지 못했어요. 다시 시도해 주세요.');
    }
  }

  if (!mealItems.length && !saved?.analysis) return <ScreenShell title="이번 한 끼 결과">
    <AnalysisSwitch period="meal" />
    <EmptyState icon="🍽️" title="아직 담긴 음식이 없어요" description="음식을 담으면 한 끼 영양을 확인할 수 있어요"
      action={<Button onClick={() => setStage('search')}>음식 담으러 가기</Button>} />
  </ScreenShell>;

  if (analysisError) return <ScreenShell title="분석을 완료하지 못했어요">
    <p className="inline-notice notice-error" role="alert">{analysisError}</p>
    <Button onClick={() => { setState(null); setRetry((value) => value + 1); }}>다시 분석하기</Button>
    <Button variant="secondary" onClick={() => setStage('search')}>음식 입력으로 돌아가기</Button>
  </ScreenShell>;

  if (!analysis) return <ScreenShell title="이번 한 끼 결과">
    <AnalysisSwitch period="meal" /><div className="loading-state" role="status"><span className="loading-dot" />영양 정보를 계산하고 있어요</div>
  </ScreenShell>;

  return <ScreenShell title="이번 한 끼 결과" subtitle={mealDateLabel(saved ? new Date(saved.confirmedAt) : openedAt)}>
    <AnalysisSwitch period="meal" />
    {saved && <p className="inline-notice notice-success" role="status"><Icon name="check" size={18} />
      {user ? '식사를 내 기록에 저장했어요' : '식사를 이 브라우저에 저장했어요'}</p>}
    <EnergySummary evaluation={analysis.evaluation} />
    <NutrientOverview evaluation={analysis.evaluation} />

    {!saved && <section className="recommend-section" aria-labelledby="recommend-title">
      <div className="section-title"><h2 id="recommend-title">이렇게 보완해보세요</h2></div>
      {analysis.recommendations.length ? <div className="recommend-list">
        {analysis.recommendations.map(({ food, reasonKeys }) => <div key={food.id} className="recommend-card">
          <ProductThumbnail food={food} /><div className="recommend-copy"><strong>{food.name}</strong>
            <p>{reasonKeys.map((key) => NUTRIENT_META.find((meta) => meta.key === key)?.label).filter(Boolean).join(', ')} 보완</p>
            <span>{food.servingLabel}{food.price != null && ` / ${food.price.toLocaleString('ko-KR')}원`}</span></div>
          <Button variant="secondary" onClick={() => { addFoodToMeal(food, 1); setStage('search'); }}>담기</Button>
        </div>)}
      </div> : <p className="recommend-empty">{analysis.evaluation.kcal?.value == null
        ? '확인할 수 있는 영양 정보가 더 필요해요. 다른 상품도 함께 살펴보세요.'
        : '현재 기록과 영양 데이터에서 추천할 상품이 없어요.'}</p>}
    </section>}

    <details className="meal-contents"><summary>{saved ? '저장한' : '담은'} 음식 {saved ? saved.items.length : mealItems.length}개<Icon name="chevron" size={16} /></summary>
      <ul>{saved ? saved.items.map((item, index) => <li key={`${item.foodId}-${index}`}><span>{item.name}</span><b>{item.qty}회</b></li>)
        : mealItems.map(({ food, qty, key }) => <li key={key}><span>{food.name}</span><b>{qty}{food.unit}</b></li>)}</ul>
    </details>

    {saveState === 'error' && <p className="inline-notice notice-error" role="alert">{saveError}<br />입력한 음식은 그대로 남아있어요.</p>}
    <div className="result-action-bar">
      <Button variant="secondary" disabled={saveState === 'saving'} onClick={() => setStage('search')}>{saved ? '새 식사 입력' : '음식 추가'}</Button>
      {saved ? <Button onClick={() => setStage('dailySummary')}>오늘 전체 보기</Button>
        : <Button disabled={saveState === 'saving'} onClick={handleConfirm}>{saveState === 'saving' ? '저장 중…' : '식사 저장하기'}</Button>}
    </div>
  </ScreenShell>;
}
