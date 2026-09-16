import { STATUS } from '../../utils/nutrition';

const STATUS_LABEL = {
  [STATUS.DEFICIENT]: '조금 부족해요',
  [STATUS.OK]: '적정해요',
  [STATUS.OVER]: '초과했어요',
  [STATUS.UNKNOWN]: '확인 필요',
};

export default function NutrientBar({ label, unit, evalItem, kind }) {
  const { status, value, goal, ratio } = evalItem;
  const pct = ratio === null ? 0 : Math.min(ratio * 100, 130);

  return (
    <div className={`nutrient-bar status-${status}`}>
      <div className="nutrient-bar-top">
        <span className="nutrient-name">{label}</span>
        <span className="nutrient-status">{STATUS_LABEL[status]}</span>
      </div>
      <div className="nutrient-track">
        <div className="nutrient-fill" style={{ width: `${pct}%` }} />
        {kind === 'target' && <div className="nutrient-goal-mark" style={{ left: '100%' }} />}
      </div>
      <div className="nutrient-bar-bottom">
        <span>
          {Math.round(value)}
          {unit} {kind === 'upperLimit' ? '섭취' : '/'} {kind !== 'upperLimit' && `${Math.round(goal)}${unit} 목표`}
        </span>
        {kind === 'upperLimit' && <span className="nutrient-limit">상한 {Math.round(goal)}{unit}</span>}
        {evalItem.partial && <span className="nutrient-partial-note">일부 성분 미확인 포함</span>}
      </div>
    </div>
  );
}
