import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Announcement } from "@/lib/sponsorship-data";
import { showDuration } from "@/lib/sponsorship-data";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  Chip,
  metaLabel,
  PlatformChip,
  StatusChip,
  Thumb,
} from "./ui";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={metaLabel}>{label}</p>
      <p className="mt-0.5 font-manrope text-[14px] font-medium leading-[22px] text-cm-text">{value}</p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-sora text-[18px] font-bold leading-[26px] text-cm-text">{title}</h3>
      {children}
    </section>
  );
}

export function DetailDialog({
  announcement,
  onOpenChange,
}: {
  announcement: Announcement | null;
  onOpenChange: (open: boolean) => void;
}) {
  const a = announcement;
  return (
    <Dialog open={!!a} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-none gap-0 border-[rgba(133,154,206,0.28)] bg-cm-panel p-0 shadow-[0_30px_80px_rgba(0,0,0,0.55)] w-[95vw] max-w-[1040px] max-h-[85vh] rounded-[24px] overflow-hidden text-cm-text">
        {a && (
          <ScrollArea className="max-h-[85vh]">
            <div className="p-6 md:p-8">
              <Thumb accent={a.accent} label={a.category} className="h-44 rounded-[18px] md:h-56" />

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <StatusChip status={a.status} />
                <Chip>{a.category}</Chip>
                {a.platforms.map((p) => (
                  <PlatformChip key={p} platform={p} />
                ))}
              </div>

              <DialogTitle className="mt-4 font-sora text-[28px] font-bold leading-[36px] text-cm-text">
                {a.title}
              </DialogTitle>
              <p className="mt-1 font-manrope text-[14px] font-medium text-cm-muted">{a.ownerName}</p>

              {/* key details */}
              <div className="mt-6 rounded-[18px] border border-[rgba(133,154,206,0.18)] bg-cm-details p-5">
                <p className={metaLabel}>{a.priceLabel}</p>
                <p className="mt-0.5 font-sora text-[24px] font-extrabold leading-[30px] text-cm-neon">
                  {a.price ?? (a.mode === "project" ? "Collaboration" : "Price to define")}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
                  <Row label="Sponsorship type" value={a.sponsorshipType} />
                  {a.videoType && <Row label="Video type" value={a.videoType} />}
                  {showDuration(a) && <Row label="Duration" value={a.duration!} />}
                  <Row label="Payment mode" value={a.paymentMode} />
                  <Row label="Availability" value={a.availability} />
                  <Row label="Deadline" value={a.deadline} />
                  <Row label={a.mode === "project" ? "Linked project" : "Linked creator"} value={a.linked} />
                </div>
              </div>

              <div className="mt-6 space-y-6">
                <Block title="Description">
                  <p className="font-manrope text-[14px] font-medium leading-[22px] text-cm-text2">
                    {a.fullDescription}
                  </p>
                </Block>

                <Block title="Requirements">
                  <ul className="space-y-1.5">
                    {a.requirements.map((r) => (
                      <li key={r} className="flex gap-2 font-manrope text-[14px] font-medium leading-[22px] text-cm-text2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cm-neon" aria-hidden />
                        {r}
                      </li>
                    ))}
                  </ul>
                </Block>

                <Block title="Expected deliverables">
                  <ul className="space-y-1.5">
                    {a.deliverables.map((d) => (
                      <li key={d} className="flex gap-2 font-manrope text-[14px] font-medium leading-[22px] text-cm-text2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cm-info" aria-hidden />
                        {d}
                      </li>
                    ))}
                  </ul>
                </Block>

                <div className="grid gap-6 md:grid-cols-2">
                  <Block title="Target audience">
                    <p className="font-manrope text-[14px] font-medium leading-[22px] text-cm-text2">
                      {a.targetAudience}
                    </p>
                  </Block>
                  <Block title={a.mode === "project" ? "Promotion objective" : "Delivery notes"}>
                    <p className="font-manrope text-[14px] font-medium leading-[22px] text-cm-text2">
                      {a.mode === "project"
                        ? "Placeholder promotion objective and expected visibility for this manga project."
                        : "Placeholder delivery notes describing offered services, content formats and turnaround."}
                    </p>
                  </Block>
                </div>

                <Block title="Application instructions">
                  <p className="font-manrope text-[14px] font-medium leading-[22px] text-cm-text2">
                    {a.contactInstructions}
                  </p>
                </Block>
              </div>

              {/* footer */}
              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[rgba(133,154,206,0.18)] pt-6">
                <button type="button" className={btnPrimary}>
                  {a.mode === "project" ? "Apply" : "Contact"}
                </button>
                <button type="button" className={btnSecondary}>
                  Save
                </button>
                <button type="button" className={btnGhost}>
                  Report
                </button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
