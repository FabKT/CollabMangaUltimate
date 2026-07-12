import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Menu, X } from "lucide-react";

export function CmaLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full" style={{ background: "var(--bg-app)" }}>
      <Sidebar />

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 cma-icon-btn"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
            <Sidebar forceVisible />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-30" style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-default)" }}>
          <button onClick={() => setMobileOpen(true)} className="cma-icon-btn" aria-label="Open menu">
            <Menu size={16} />
          </button>
          <div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>CollabManga AI</div>
        </div>

        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4" style={{ marginBottom: 24 }}>
      <div className="min-w-0">
        <h1 className="cma-page-title">{title}</h1>
        {description && (
          <p className="mt-1" style={{ font: "500 14px/22px var(--font-sans)", color: "var(--text-secondary)" }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}

export function Card({
  children, className = "", padding = 20, selected = false, as: As = "div",
}: { children: ReactNode; className?: string; padding?: number; selected?: boolean; as?: "div" | "button" | "a" }) {
  const Tag = As as any;
  return (
    <Tag
      className={className}
      style={{
        background: "var(--bg-elevated)",
        border: `1px solid ${selected ? "var(--neon-soft-border)" : "var(--border-default)"}`,
        borderRadius: 16,
        padding,
        boxShadow: selected ? "var(--shadow-neon)" : "var(--shadow-card)",
        color: "var(--text-primary)",
        textAlign: "left",
        width: "100%",
        display: "block",
      }}
    >
      {children}
    </Tag>
  );
}

export function Panel({ children, className = "", padding = 20 }: { children: ReactNode; className?: string; padding?: number }) {
  return (
    <div
      className={className}
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border-default)",
        borderRadius: 22,
        padding,
        boxShadow: "var(--shadow-panel)",
      }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <h2 className="cma-section-title">{children}</h2>
      {right}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="cma-label mb-2">{children}</div>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={"cma-input " + (props.className ?? "")}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--neon)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(57,255,136,0.10)"; props.onFocus?.(e); }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(133,154,206,0.2)"; e.currentTarget.style.boxShadow = "none"; props.onBlur?.(e); }}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={"cma-input " + (props.className ?? "")}
      style={{ minHeight: 110, resize: "vertical", ...(props.style ?? {}) }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--neon)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(57,255,136,0.10)"; props.onFocus?.(e); }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(133,154,206,0.2)"; e.currentTarget.style.boxShadow = "none"; props.onBlur?.(e); }}
    />
  );
}

export function Chip({ children, active = false, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={"cma-chip " + (active ? "cma-chip-active" : "")}
      type="button"
    >
      {children}
    </button>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; icon?: ReactNode }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div
      className="inline-flex items-center gap-1 p-1"
      style={{ background: "var(--bg-input)", border: "1px solid var(--border-default)", borderRadius: 999 }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={"cma-tab " + (value === t.id ? "cma-tab-active" : "")}
          type="button"
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
