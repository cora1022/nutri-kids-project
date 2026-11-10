interface StepDef {
  key: string;
  label: string;
}

const STEPS: StepDef[] = [
  { key: 'onboard', label: '목표 설정' },
  { key: 'search', label: '음식 입력' },
  { key: 'evaluate', label: '평가·추천' },
];

interface StageTrackerProps {
  current: string;
}

export default function StageTracker({ current }: StageTrackerProps) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="stage-tracker">
      {STEPS.map((s, i) => (
        <div key={s.key} className={`stage-dot ${i === currentIdx ? 'active' : ''} ${i < currentIdx ? 'done' : ''}`}>
          <span className="stage-num">{i + 1}</span>
          <span className="stage-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
