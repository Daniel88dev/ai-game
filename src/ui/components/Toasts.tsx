import type { Runtime } from '../../runtime';
import { useUi } from '../hooks';

export function Toasts({ rt }: { rt: Runtime }) {
  const { toasts } = useUi(rt);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`panel toast toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
