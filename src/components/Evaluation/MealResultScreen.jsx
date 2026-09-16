import { useMemo, useState } from 'react';
import Button from '../common/Button';
import { Card, EmptyState, ScreenShell } from '../common/Card';
import NutrientBar from '../common/NutrientBar';
import StageTracker from '../common/StageTracker';
import { useApp } from '../../hooks/useApp';
import { NUTRIENT_META } from '../../data/goals';
import { evaluateNutrients, getDeficientKeys, recommendFoods, sumNutrients } from '../../utils/nutrition';

export default function MealResultScreen() {
  const { mealItems, mealGoals, setStage, confirmMeal, addFoodToMeal } = useApp();
  const [saveState, setSaveState] = useState('idle'); // idle | saving | error | saved
  const [askDayDone, setAskDayDone] = useState(false);

  const totals = useMemo(() => sumNutrients(mealItems), [mealItems]);
  const evaluation = useMemo(() => evaluateNutrients(totals, mealGoals), [totals, mealGoals]);
  const deficientKeys = useMemo(() => getDeficientKeys(evaluation), [evaluation]);
  const excludeIds = mealItems.map((i) => i.food.id);
  const recommendation = useMemo(
    () => recommendFoods({ totals, goals: mealGoals, deficientKeys, excludeIds }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [totals, mealGoals, deficientKeys]
  );

  // 1) 빈 식사
  if (mealItems.length === 0) {
    return (
      <ScreenShell eyebrow="03 한 끼 평가" title="담긴 음식이 없어요">
        <StageTracker current="evaluate" />
        <EmptyState
          icon="🍽️"
          title="빈 식사예요"
          description="평가하려면 먼저 음식을 입력해 주세요"
          action={<Button onClick={() => setStage('search')}>음식 입력으로 돌아가기</Button>}
        />
      </ScreenShell>
    );
  }

  async function handleConfirm() {
    setSaveState('saving');
    try {
      await confirmMeal();
      setSaveState('saved');
      setAskDayDone(true);
    } catch {
      setSaveState('error');
    }
  }

  function handleDayDone(isDone) {
    setAskDayDone(false);
    setStage(isDone ? 'dailySummary' : 'search');
  }

  if (askDayDone) {
    return (
      <ScreenShell eyebrow="03 한 끼 평가" title="한 끼 저장 완료!">
        <Card tone="success">
          <p>오늘 기록을 모두 마쳤나요?</p>
          <div className="button-row">
            <Button variant="secondary" onClick={() => handleDayDone(false)}>
              아니요, 더 먹을 거예요
            </Button>
            <Button onClick={() => handleDayDone(true)}>네, 오늘은 끝!</Button>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell eyebrow="03 한 끼 평가 · 추천" title="이번 한 끼 결과예요">
      <StageTracker current="evaluate" />

      <div className="nutrient-bar-list">
        {NUTRIENT_META.map(({ key, label, unit, kind }) => (
          <NutrientBar key={key} label={label} unit={unit} kind={kind} evalItem={evaluation[key]} />
        ))}
      </div>

      {deficientKeys.length > 0 && (
        <Card tone="muted" className="recommend-block">
          <h3>이런 걸 더해보는 건 어때요?</h3>
          {recommendation.candidates.length === 0 ? (
            <p className="muted-line">{recommendation.reason || '추천할 항목이 없어요'}</p>
          ) : (
            <div className="recommend-list">
              {recommendation.candidates.map(({ food, reasonKeys }) => (
                <div key={food.id} className="recommend-card">
                  <div>
                    <strong>{food.name}</strong>
                    <p className="muted-line">
                      {food.servingLabel} · {reasonKeys.map((k) => NUTRIENT_META.find((n) => n.key === k)?.label).join(', ')} 보충
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      addFoodToMeal(food, 1);
                      setStage('search');
                    }}
                  >
                    담으러 가기
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {saveState === 'error' && (
        <Card tone="danger">
          <p>저장에 실패했어요. 입력한 내용은 그대로 남아있으니 다시 시도해 주세요.</p>
          <Button onClick={handleConfirm}>다시 저장하기</Button>
        </Card>
      )}

      <div className="button-row">
        <Button variant="secondary" onClick={() => setStage('search')}>
          추가·수정하기
        </Button>
        <Button onClick={handleConfirm} disabled={saveState === 'saving'}>
          {saveState === 'saving' ? '저장 중…' : '이대로 확정하기'}
        </Button>
      </div>
    </ScreenShell>
  );
}
