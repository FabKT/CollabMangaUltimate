import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DURATIONS,
  PLATFORMS,
  SPONSORSHIP_TYPES,
  VIDEO_TYPES,
  type AnnouncementMode,
} from "@/lib/sponsorship-data";
import { btnPrimary, btnSecondary, inputCls, metaLabel, PlatformChip } from "./ui";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className={metaLabel}>{label}</span>
      {children}
    </label>
  );
}

function SelectInput({ placeholder, options }: { placeholder: string; options: string[] }) {
  return (
    <select className={inputCls} defaultValue="">
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o} value={o} className="bg-cm-input text-cm-text">
          {o}
        </option>
      ))}
    </select>
  );
}

export function CreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [type, setType] = useState<AnnouncementMode>("creator");
  const [platforms, setPlatforms] = useState<string[]>([]);

  const toggle = (p: string) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-none gap-0 border-[rgba(133,154,206,0.28)] bg-cm-panel p-0 w-[95vw] max-w-[860px] max-h-[85vh] rounded-[24px] overflow-hidden text-cm-text">
        <ScrollArea className="max-h-[85vh]">
          <div className="p-6 md:p-8">
            <DialogTitle className="font-sora text-[28px] font-bold leading-[36px] text-cm-text">
              Create announcement
            </DialogTitle>
            <DialogDescription className="mt-1 font-manrope text-[14px] font-medium text-cm-text2">
              Publish a sponsorship offer or a promotion request.
            </DialogDescription>

            {/* type */}
            <div className="mt-6 space-y-3">
              <span className={metaLabel}>Announcement type</span>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { key: "creator", label: "Content creator offer" },
                    { key: "project", label: "Manga project request" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setType(opt.key)}
                    aria-pressed={type === opt.key}
                    className={cn(
                      "h-11 rounded-[14px] px-4 font-manrope text-[14px] font-bold transition-colors",
                      type === opt.key
                        ? "bg-cm-neon text-[#04111e] shadow-[0_6px_18px_rgba(57,255,136,0.25)]"
                        : "bg-cm-card border border-[rgba(133,154,206,0.28)] text-cm-text",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* main info */}
            <section className="mt-8 space-y-3">
              <h3 className="font-sora text-[18px] font-bold leading-[26px] text-cm-text">Main information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Title">
                    <input className={inputCls} placeholder="Announcement title" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <span className={metaLabel}>Image</span>
                  <div className="mt-1.5 flex h-28 w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-[rgba(133,154,206,0.28)] bg-cm-input font-manrope text-[13px] font-medium text-cm-muted">
                    <ImagePlus className="h-4 w-4" /> Upload image placeholder
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Short description">
                    <input className={inputCls} placeholder="One line summary" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <label className="block space-y-1.5">
                    <span className={metaLabel}>Full description</span>
                    <textarea
                      className={cn(inputCls, "h-28 resize-none py-3")}
                      placeholder="Describe the offer or request in detail"
                    />
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <span className={metaLabel}>Platforms</span>
                  <div className="mt-1.5 flex flex-wrap gap-3">
                    {PLATFORMS.map((p) => (
                      <PlatformChip
                        key={p}
                        platform={p}
                        as="button"
                        active={platforms.includes(p)}
                        onClick={() => toggle(p)}
                      />
                    ))}
                  </div>
                </div>
                <Field label={type === "project" ? "Budget" : "Price"}>
                  <input className={inputCls} placeholder="Price placeholder" />
                </Field>
                <Field label="Payment mode">
                  <SelectInput placeholder="Select mode" options={["Fixed fee", "Negotiable", "Collaboration", "Custom"]} />
                </Field>
                <Field label="Sponsorship type">
                  <SelectInput placeholder="Select type" options={SPONSORSHIP_TYPES} />
                </Field>
                <Field label="Video type">
                  <SelectInput placeholder="Select video type" options={VIDEO_TYPES} />
                </Field>
                <Field label="Duration">
                  <SelectInput placeholder="Select duration" options={DURATIONS} />
                </Field>
                <Field label="Status">
                  <SelectInput placeholder="Select status" options={["Open", "Urgent", "Closing soon"]} />
                </Field>
              </div>
            </section>

            {/* additional info */}
            <section className="mt-8 space-y-3">
              <h3 className="font-sora text-[18px] font-bold leading-[26px] text-cm-text">Additional information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Requirements">
                    <input className={inputCls} placeholder="Requirements placeholder" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Deliverables">
                    <input className={inputCls} placeholder="Deliverables placeholder" />
                  </Field>
                </div>
                <Field label="Deadline">
                  <input className={inputCls} placeholder="Deadline placeholder" />
                </Field>
                <Field label="Linked project">
                  <input className={inputCls} placeholder="Linked project placeholder" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Contact instructions">
                    <input className={inputCls} placeholder="How applicants should reach you" />
                  </Field>
                </div>
              </div>
            </section>

            <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-[rgba(133,154,206,0.18)] pt-6">
              <button type="button" className={btnSecondary} onClick={() => onOpenChange(false)}>
                Cancel
              </button>
              <button type="button" className={btnPrimary} onClick={() => onOpenChange(false)}>
                Send Proposal
              </button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
