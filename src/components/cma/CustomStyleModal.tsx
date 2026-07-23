import { useEffect, useRef, useState } from "react";
import { ImageIcon, Plus, Trash2, Upload, X } from "lucide-react";
import { addCustomMangaStyle, type CustomMangaStyle } from "@/lib/custom-manga-styles";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(file);
  });
}

export function CustomStyleModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (style: CustomMangaStyle) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setImages([]);
    setActiveIndex(0);
    setSaving(false);
    setError(null);
  }, [open]);

  if (!open) return null;

  const importImages = async (files: FileList | null) => {
    const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    const next = await Promise.all(imageFiles.map(fileToDataUrl));
    setImages((current) => [...current, ...next]);
  };

  const removeImage = (index: number) => {
    setImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
    setActiveIndex((current) => Math.max(0, current > index ? current - 1 : Math.min(current, images.length - 2)));
  };

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Donne un nom au style.");
    if (!images.length) return setError("Ajoute au moins une image à la bibliothèque.");
    setSaving(true);
    try {
      const style = await addCustomMangaStyle({ name, images });
      onSaved(style);
      onClose();
    } catch {
      setError("Le style n'a pas pu être enregistré.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(3,7,18,0.82)" }} onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[18px] border border-border bg-surface-2 shadow-panel" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-[18px] font-bold">Créer un style</h2>
            <p className="mt-1 text-[12px] text-text-secondary">Nomme le style et constitue sa bibliothèque visuelle.</p>
          </div>
          <button type="button" onClick={onClose} className="cma-icon-btn" aria-label="Fermer"><X className="h-4 w-4" /></button>
        </header>

        <div className="scroll-dark grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div className="min-w-0">
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void importImages(event.currentTarget.files); event.currentTarget.value = ""; }} />
            <button type="button" onClick={() => inputRef.current?.click()} className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[14px] border border-dashed border-border-strong bg-stage hover:border-accent">
              {images[activeIndex] ? <img src={images[activeIndex]} alt="Référence du style" className="h-full w-full object-contain" /> : <span className="flex flex-col items-center gap-3 text-text-secondary"><Upload className="h-8 w-8" /><span className="text-[13px] font-bold">Ajouter des images</span></span>}
            </button>
            <div className="scroll-dark mt-3 flex min-h-[72px] gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <div key={`${image.slice(-24)}-${index}`} className={`group relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-[10px] border ${activeIndex === index ? "border-accent" : "border-border"}`}>
                  <button type="button" onClick={() => setActiveIndex(index)} className="h-full w-full"><img src={image} alt={`Référence ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" /></button>
                  <button type="button" onClick={() => removeImage(index)} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-[7px] bg-black/70 text-white opacity-0 transition group-hover:opacity-100" aria-label="Retirer l'image"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <button type="button" onClick={() => inputRef.current?.click()} className="grid h-[68px] w-[68px] shrink-0 place-items-center rounded-[10px] border border-dashed border-border-strong bg-surface-3 text-text-secondary hover:border-accent hover:text-accent" aria-label="Ajouter des images"><Plus className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="flex min-w-0 flex-col">
            <label className="text-[12px] font-bold text-text-secondary" htmlFor="custom-style-name">Nom du style</label>
            <input id="custom-style-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex : Encrage personnel" className="cma-input mt-2" />
            <div className="mt-4 rounded-[14px] border border-border bg-surface-3 p-4">
              <div className="flex items-center gap-2 text-[13px] font-bold"><ImageIcon className="h-4 w-4 text-accent" />Bibliothèque</div>
              <p className="mt-2 text-[12px] leading-5 text-text-secondary">La première image devient la couverture du style. Toutes les images restent enregistrées dans sa bibliothèque.</p>
              <p className="mt-3 text-[12px] font-bold text-text-primary">{images.length} image{images.length > 1 ? "s" : ""}</p>
            </div>
            {error && <p className="mt-4 rounded-[12px] border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{error}</p>}
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-border p-4">
          <button type="button" onClick={onClose} className="cma-btn-secondary">Annuler</button>
          <button type="button" onClick={() => void save()} disabled={saving} className="cma-btn-primary">{saving ? "Enregistrement..." : "Créer le style"}</button>
        </footer>
      </div>
    </div>
  );
}
