export function Bar({ value, max, tone, label }: { value: number; max: number; tone: 'hp' | 'focus' | 'xp'; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className={`bar bar-${tone}`} role="meter" aria-label={label} aria-valuenow={value} aria-valuemax={max}>
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="bar-value">
        {value}/{max}
      </span>
    </div>
  );
}
