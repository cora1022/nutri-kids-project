import type { EvaluationItem, EvaluationStatus, NutrientKind } from '../../types';

const STATUS_LABEL: Record<EvaluationStatus, string> = {
  deficient: '조금 부족해요',
  ok: '적정해요',
  over: '초과했어요',
  unknown: '확인 필요',
};

interface NutrientBarProps {
  label: string;
  unit: string;
  evalItem: EvaluationItem;
  kind: NutrientKind;
}

export default function NutrientBar({ label, unit, evalItem, kind }: NutrientBarProps) {
  const { status, value, goal, upperLimit, ratio } = evalItem;
  const pct = ratio === null ? 0 : Math.min(ratio * 100, 130);
  const goalLabel = kind === 'adequateIntake' ? '충분섭취량' : '한 끼 목표';

  return (
    <div className={`nutrient-bar status-${status}`}>
      <div className="nutrient-bar-top">
        <span className="nutrient-name">{label}</span>
        <span className="nutrient-status">{STATUS_LABEL[status]}</span>
      </div>
      <div className="nutrient-track">
        <div className="nutrient-fill" style={{ width: `${pct}%` }} />
        {goal !== null && <div className="nutrient-goal-mark" style={{ left: '100%' }} />}
      </div>
      <div className="nutrient-bar-bottom">
        <span>
          {value === null ? '미확인' : `${Math.round(value)}${unit}`}
          {goal !== null && ` / ${Math.round(goal)}${unit} ${goalLabel}`}
          {goal === null && ' / 평가 기준 미설정'}
        </span>
        {upperLimit !== null && upperLimit !== undefined && (
          <span className="nutrient-limit">하루 상한 {Math.round(upperLimit)}{unit}</span>
        )}
        {evalItem.partial && <span className="nutrient-partial-note">일부 성분 미확인 포함</span>}
      </div>
    </div>
  );
}
