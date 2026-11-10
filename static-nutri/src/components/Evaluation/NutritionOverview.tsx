import { useId } from 'react';
import { NUTRIENT_META } from '../../data/goals';
import { energyPercent, formatAmount, nutrientLabel, resultSummary } from '../../utils/resultPresentation';
import type { Evaluation, NutrientKey } from '../../types';
import Icon from '../common/Icon';
import { useApp } from '../../hooks/useApp';

export function AnalysisSwitch({ period }: { period: 'meal' | 'day' }) {
  const { setStage } = useApp();
  return <nav className="analysis-switch" aria-label="분석 기간">
    <button aria-current={period === 'meal' ? 'page' : undefined} onClick={() => setStage('evaluate')}>이번 한 끼</button>
    <button aria-current={period === 'day' ? 'page' : undefined} onClick={() => setStage('dailySummary')}>오늘 전체</button>
  </nav>;
}

export function EnergySummary({ evaluation, period = 'meal' }: { evaluation: Evaluation; period?: 'meal' | 'day' }) {
  const energy = evaluation.kcal;
  const percent = energyPercent(energy);
  return <section className="energy-summary" aria-label={period === 'day' ? '하루 열량 요약' : '한 끼 열량 요약'}>
    <p className="energy-caption">{period === 'day' ? '기록한 하루 열량' : '한 끼 열량'}</p>
    <div className="energy-numbers"><div><strong>{formatAmount(energy?.value)}</strong>
      {energy?.value != null && <span className="energy-unit">kcal</span>}
      {energy?.goal != null && <span className="energy-target">/ 목표 {formatAmount(energy.goal)} kcal</span>}</div>
      {percent != null && <span className="energy-percent">{percent}%</span>}</div>
    <div className={`energy-track ${percent === null ? 'track-missing' : ''}`} aria-hidden="true">
      {percent != null && <span style={{ width: `${Math.min(percent, 100)}%` }} />}</div>
    <p className="energy-message"><Icon name="info" size={17} />{resultSummary(evaluation)}</p>
  </section>;
}

const PRIMARY_KEYS: NutrientKey[] = ['protein', 'carbohydrate', 'calcium', 'vitaminC', 'vitaminD'];

export function NutrientOverview({ evaluation, period = 'meal' }: { evaluation: Evaluation; period?: 'meal' | 'day' }) {
  const headingId = useId();
  const estimated = Object.values(evaluation).some((item) => item?.quality === 'ESTIMATED' || item?.quality === 'MIXED');
  const missing = Object.values(evaluation).some((item) => item?.value == null);

  function row(key: NutrientKey) {
    const meta = NUTRIENT_META.find((item) => item.key === key)!;
    const item = evaluation[key];
    const label = nutrientLabel(item, meta.kind);
    const missingValue = !item || item.value == null;
    const assessed = meta.kind !== 'unassessed' && item?.goal != null;
    const ratio = missingValue || !assessed ? null : item?.ratio;
    return <div key={key} className={`overview-row status-${item?.status ?? 'unknown'} ${missingValue ? 'is-missing' : ''}`}>
      <span className="overview-name">{meta.label}</span>
      <span className="overview-value">{formatAmount(item?.value)}
        {!missingValue && <>{assessed && <> / {formatAmount(item.goal)}</>} <small>{meta.unit}</small></>}
      </span>
      <span className={`overview-track ${ratio == null ? 'track-missing' : ''}`} aria-hidden="true">
        {ratio != null && <i style={{ width: `${Math.max(0, Math.min(ratio * 100, 100))}%` }} />}
      </span>
      <span className={`overview-status ${!assessed || missingValue ? 'neutral-status' : ''}`}>{label}</span>
    </div>;
  }

  return <section className="nutrient-overview" aria-labelledby={headingId}>
    <div className="section-title"><h2 id={headingId}>영양소 한눈에</h2>
      {estimated && <span className="quality-chip">추정값 포함</span>}</div>
    <div className="overview-card">
      {PRIMARY_KEYS.map(row)}
      <details className="more-nutrients"><summary>전체 영양소 보기<Icon name="chevron" size={16} /></summary>
        {(['vitaminA', 'iron', 'sodium'] as NutrientKey[]).map(row)}
        <p className="overview-footnote">철분과 나트륨은 섭취량만 표시해요. 비타민 D가 충분섭취량보다 낮으면 부족 여부를 단정하지 않아요.</p>
      </details>
    </div>
    {missing && <p className="section-note">미확인 항목은 0이 아닌 점선으로 표시해요.</p>}
    <details className="analysis-notes"><summary>계산 기준 확인하기<Icon name="info" size={15} /></summary>
      <p>{period === 'day' ? '저장한 식사만 합산하고 현재 프로필의 하루 목표와 비교해요.' : '하루 목표를 설정한 식사 횟수로 나눈 계획량과 비교해요.'}
        {' '}추정값은 실제 상품의 영양표시와 다를 수 있어요. 충분섭취량과 목표 범위는 영양소에 따라 다르게 적용돼요.</p>
      {NUTRIENT_META.filter(({ key }) => evaluation[key]?.upperLimit != null).map(({ key, label, unit }) =>
        <p key={key}>{label} 하루 상한 {formatAmount(evaluation[key].upperLimit)} {unit}</p>)}
    </details>
  </section>;
}
