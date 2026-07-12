import { useState, type ReactNode } from "react";
import { CollabSidebar } from "./CollabSidebar";
import { Menu, X } from "lucide-react";

export function CollabLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full" style={{ background: "var(--bg-app)" }}>
      <CollabSidebar />

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
            <CollabSidebar forceVisible />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div
          className="md:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-30"
          style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-default)" }}
        >
          <button onClick={() => setMobileOpen(true)} className="cma-icon-btn" aria-label="Open menu">
            <Menu size={16} />
          </button>
          <div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>
            CollabManga
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
