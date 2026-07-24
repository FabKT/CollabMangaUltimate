import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { GENERATION_ACTIVITY_EVENT } from "@/lib/durable-generation";
import { useI18n } from "@/lib/i18n";

export function GenerationWaitNotice() {
  const { t } = useI18n();
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    const onActivity = (event: Event) => {
      const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      setActiveCount((count) => Math.max(0, count + (active ? 1 : -1)));
    };
    window.addEventListener(GENERATION_ACTIVITY_EVENT, onActivity);
    return () => window.removeEventListener(GENERATION_ACTIVITY_EVENT, onActivity);
  }, []);

  if (activeCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[80] flex w-[min(92vw,520px)] -translate-x-1/2 items-start gap-3 rounded-[12px] border border-[var(--neon-soft-border)] bg-[var(--bg-elevated)] px-4 py-3 shadow-2xl"
    >
      <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--neon)]" />
      <div>
        <p className="text-[13px] font-bold text-[var(--text-primary)]">
          {t("ai.generationMayTake")}
        </p>
        <p className="mt-0.5 text-[12px] font-medium text-[var(--text-secondary)]">
          {t("ai.doNotLeaveGeneration")}
        </p>
      </div>
    </div>
  );
}
