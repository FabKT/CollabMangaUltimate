import { useEffect, useState } from "react";
import { Modal, Field, inputCls } from "./ui";
import { newServiceId, PLATFORMS, upsertService, type PaymentType, type Platform, type Service } from "./store";

export function ServiceModal({
  open,
  onClose,
  sponsorshipId,
  initial,
  onSaveDraft,
}: {
  open: boolean;
  onClose: () => void;
  sponsorshipId?: string;
  initial?: Service;
  onSaveDraft?: (service: Service) => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState("");
  const [format, setFormat] = useState("");
  const [duration, setDuration] = useState("0–30 s");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [paymentType, setPaymentType] = useState<PaymentType>("one_time");
  const [deliveryLink, setDeliveryLink] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name); setFormat(initial.format); setDuration(initial.duration);
      setPlatforms(initial.platforms); setQuantity(initial.quantity); setPrice(initial.price);
      setPaymentType(initial.paymentType); setDeliveryLink(initial.deliveryLink ?? ""); setNotes(initial.notes ?? "");
    } else {
      setName(""); setFormat(""); setDuration("0–30 s"); setPlatforms([]);
      setQuantity(1); setPrice(0); setPaymentType("one_time"); setDeliveryLink(""); setNotes("");
    }
  }, [open, initial]);

  const submit = () => {
    if (!name.trim()) return;
    const svc: Service = {
      id: initial?.id ?? newServiceId(),
      name: name.trim(),
      format: format.trim() || "Sponsored mention",
      duration,
      platforms,
      quantity: Math.max(1, Number(quantity) || 1),
      price: Math.max(0, Number(price) || 0),
      paymentType,
      deliveryLink: deliveryLink.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (onSaveDraft) {
      onSaveDraft(svc);
    } else if (sponsorshipId) {
      upsertService(sponsorshipId, svc);
    }
    onClose();
  };

  const toggle = (p: Platform) => setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const serviceNames = ["Placement in a video", "Dedicated long video", "Short video", "Story", "Post", "Review", "Reaction", "Presentation", "Stream mention"];
  const formats = ["Presentation", "Deep analysis", "Review", "Reaction", "Sponsored mention", "Product placement", "Dedicated content"];
  const durations = ["0–30 s", "30–60 s", "1–3 min", "10+ min"];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit service" : "Add service"}
      size="lg"
      footer={
        <>
          <button className="btn-ghost rounded-lg px-4 py-2 text-sm font-medium" onClick={onClose}>Cancel</button>
          <button className="btn-neon rounded-lg px-4 py-2 text-sm font-semibold" onClick={submit}>{isEdit ? "Save changes" : "Add service"}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Service name" required>
          <input list="service-names" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Dedicated long video" />
          <datalist id="service-names">{serviceNames.map((n) => <option key={n} value={n} />)}</datalist>
        </Field>
        <Field label="Format">
          <select className={inputCls} value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="">Select format…</option>
            {formats.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Duration">
          <select className={inputCls} value={duration} onChange={(e) => setDuration(e.target.value)}>
            {durations.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Quantity">
          <input type="number" min={1} className={inputCls} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        </Field>
        <Field label="Service price">
          <input type="number" min={0} className={inputCls} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </Field>
        <Field label="Payment type">
          <select className={inputCls} value={paymentType} onChange={(e) => setPaymentType(e.target.value as PaymentType)}>
            <option value="one_time">One-time</option>
            <option value="subscription">Subscription</option>
            <option value="recurring">Recurring</option>
            <option value="per_content">Per content</option>
            <option value="per_quantity">Per quantity</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Platforms">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const active = platforms.includes(p);
                return (
                  <button key={p} type="button" onClick={() => toggle(p)} aria-pressed={active}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${active ? "border-neon/60 bg-neon-soft text-neon" : "border-border bg-surface-3 text-text-secondary hover:text-foreground"}`}>
                    {p}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Delivery link" hint="Add once content is published to verify delivery.">
            <input className={inputCls} value={deliveryLink} onChange={(e) => setDeliveryLink(e.target.value)} placeholder="https://…" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea className={`${inputCls} min-h-[70px]`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Talking points, disclaimers, brand-safe language…" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
