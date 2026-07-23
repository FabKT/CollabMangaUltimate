import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { CollabSidebar } from "./CollabSidebar";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export function CollabLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen w-full" style={{ background: "var(--bg-app)" }}>
      <CollabSidebar />

      {/* Phone/tablet navigation opens as a top menu, never as a sidebar. */}
      {mobileOpen && (
        <div className="cm-mobile-nav-overlay xl:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-x-3 top-3 max-h-[calc(100dvh-24px)] overflow-hidden rounded-[18px] border border-[var(--border-strong)] shadow-2xl">
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
          className="cm-mobile-nav-bar xl:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-30"
          style={{ background: "var(--bg-app)", borderBottom: "1px solid var(--border-default)" }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="cma-icon-btn"
            aria-label="Open menu"
          >
            <Menu size={16} />
          </button>
          <BrandMark size={24} />
          <div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>
            CollabManga
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
