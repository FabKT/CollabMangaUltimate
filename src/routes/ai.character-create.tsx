import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/cma/Layout";
import { loadSession, saveSession } from "@/lib/manga-session";
import { createId } from "@/lib/manga-workspace";
import type { CharacterImageResult } from "@/server-functions/character-image";
import { hasPendingGeneration, resumeDurableGeneration, runDurableGeneration } from "@/lib/durable-generation";
import { notifyCreditsChanged } from "@/lib/credits-events";
import { recordGeneratedImage } from "@/lib/manga-history";
import { MANGA_STYLES, type MangaStyle } from "@/lib/manga-styles";
import { loadCustomMangaStyles, type CustomMangaStyle } from "@/lib/custom-manga-styles";
import { CustomStyleModal } from "@/components/cma/CustomStyleModal";
import {
  Palette,
  FileText,
  Images as ImagesIcon,
  Upload,
  Trash2,
  Wand2,
  Check,
  Download,
  X,
  Sparkles,
  ImageIcon,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/ai/character-create")({
  head: () => ({ meta: [{ title: "Création de personnage — CollabManga AI" }] }),
  component: CharacterCreatePage,
});

const STYLES = MANGA_STYLES;
const DEFAULT_STYLE_ID = STYLES.find((style) => style.id === "realistic")?.id ?? STYLES[0].id;

type CharacterReference = {
  id: string;
  name: string;
  imageDataUrl?: string;
  description?: string;
};

type CharacterSessionSnapshot = {
  tab?: "style" | "references" | "prompt";
  styleId?: string;
  identityReference?: CharacterReference | null;
  references?: CharacterReference[];
  prompt?: string;
  result?: CharacterImageResult | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(blob);
  });
}

async function imageSourceToDataUrl(src?: string) {
  if (!src) return undefined;
  if (src.startsWith("data:")) return src;
  const response = await fetch(src);
  if (!response.ok) return undefined;
  return blobToDataUrl(await response.blob());
}

function CharacterCreatePage() {
  const [tab, setTab] = useState<"style" | "references" | "prompt">("style");
  const [styleId, setStyleId] = useState<string>(DEFAULT_STYLE_ID);
  const [customStyles, setCustomStyles] = useState<CustomMangaStyle[]>([]);
  const [createStyleOpen, setCreateStyleOpen] = useState(false);
  const [identityReference, setIdentityReference] = useState<CharacterReference | null>(null);
  const [references, setReferences] = useState<CharacterReference[]>([]);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<CharacterImageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [confirmStyle, setConfirmStyle] = useState<MangaStyle | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void loadSession<CharacterSessionSnapshot>("character-create").then((snap) => {
      if (snap) {
        setTab(snap.tab ?? "style");
        setStyleId(snap.styleId ?? DEFAULT_STYLE_ID);
        setIdentityReference(snap.identityReference ?? null);
        setReferences(snap.references ?? []);
        setPrompt(snap.prompt ?? "");
        if (snap.result) setResult(snap.result);
      }
      setLoaded(true);
    });
    void loadCustomMangaStyles().then(setCustomStyles);
  }, []);

  useEffect(() => {
    if (!hasPendingGeneration("character-create")) return;
    setIsGenerating(true);
    void resumeDurableGeneration<CharacterImageResult>("character-create").then((generated) => {
      if (generated) setResult(generated);
    }).catch((err) => setError(err instanceof Error ? err.message : "Character generation failed."))
      .finally(() => setIsGenerating(false));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void saveSession<CharacterSessionSnapshot>("character-create", {
      tab,
      styleId,
      identityReference,
      references,
      prompt,
      result,
    });
  }, [loaded, tab, styleId, identityReference, references, prompt, result]);

  const activeStyle = STYLES.find((style) => style.id === styleId);
  const activeCustomStyle = customStyles.find((style) => style.id === styleId);

  const importIdentityReference = async (files: FileList | null) => {
    const file = Array.from(files ?? []).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    setIdentityReference({
      id: createId("identity"),
      name: file.name.replace(/\.[^.]+$/, "") || "Image d'identite",
      imageDataUrl: await fileToDataUrl(file),
      description: "Mandatory character identity reference",
    });
  };

  const importReferences = async (files: FileList | null) => {
    const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    const imported = await Promise.all(
      imageFiles.slice(0, 6).map(async (file) => ({
        id: createId("ref"),
        name: file.name.replace(/\.[^.]+$/, "") || "Référence",
        imageDataUrl: await fileToDataUrl(file),
        description: "",
      })),
    );
    setReferences((current) => [...imported, ...current]);
  };

  const generate = async () => {
    if (!identityReference?.imageDataUrl) {
      setTab("references");
      setError("Importe d'abord l'image d'identite du personnage.");
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const selectedStyle = activeStyle ?? STYLES[0];
      const [defaultStyleImageDataUrl, structureImageDataUrl] = await Promise.all([
        activeCustomStyle ? Promise.resolve(activeCustomStyle.images[0]) : imageSourceToDataUrl(selectedStyle.face),
        imageSourceToDataUrl(selectedStyle.card),
      ]);
      const generated = await runDurableGeneration<CharacterImageResult>(
        "character-create",
        "/api/character/generate",
        {
          prompt: prompt.trim(),
          identityImageDataUrl: identityReference.imageDataUrl,
          identityReferenceName: identityReference.name,
          styleId,
          styleName: activeCustomStyle?.name ?? selectedStyle.name,
          styleDescription: activeCustomStyle ? "Style personnalisé défini par la bibliothèque d'images." : selectedStyle.description,
          styleImageDataUrl: defaultStyleImageDataUrl,
          styleReferenceImages: activeCustomStyle?.images ?? [],
          structureImageDataUrl,
          references,
        },
      );
      setResult(generated);
      void recordGeneratedImage({
        source: "Creation de personnage",
        title: identityReference.name || "Carte de personnage",
        prompt,
        result: generated,
        editContext: {
          originalImageUrl: generated.imageUrl,
          currentImageUrl: generated.imageUrl,
          prompt: "",
          selectedCharacterIds: [],
          references: [
            { ...identityReference, imageDataUrl: identityReference.imageDataUrl, role: "Inspiration" as const },
            ...references
              .filter((reference) => reference.imageDataUrl)
              .map((reference) => ({ ...reference, imageDataUrl: reference.imageDataUrl!, role: "Inspiration" as const })),
            ...(defaultStyleImageDataUrl ? [{ id: `${styleId}-style`, name: "Style", imageDataUrl: defaultStyleImageDataUrl, role: "Style" as const }] : []),
            ...(structureImageDataUrl ? [{ id: `${styleId}-structure`, name: "Structure", imageDataUrl: structureImageDataUrl, role: "Storyboard" as const }] : []),
          ],
          aspectRatio: "3:2",
          source: "Creation de personnage",
        },
      });
      notifyCreditsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Character generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const download = () => {
    if (!result?.imageUrl) return;
    const link = document.createElement("a");
    link.href = result.imageUrl;
    link.download = `collabmanga-character-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="manga-canvas-page w-full min-w-0 text-text-primary">
      <PageHeader
        title="Création de personnage"
        description="Choisis un style, ajoute des références, décris ton personnage : une carte complète (face / profil / dos + 6 expressions) est générée en 3:2."
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* LEFT — style / references / prompt */}
        <section className="shadow-panel flex min-w-0 flex-col rounded-[18px] border border-border bg-surface-2">
          <div className="flex items-center gap-1 border-b border-border p-3">
            {(
              [
                { id: "style", label: "Style", icon: Palette },
                { id: "references", label: "Référence", icon: ImagesIcon },
                { id: "prompt", label: "Prompt", icon: FileText },
              ] as const
            ).map((entry) => (
              <button
                key={entry.id}
                onClick={() => setTab(entry.id)}
                className={`flex h-[38px] flex-1 items-center justify-center gap-2 rounded-[12px] text-[12px] font-bold transition ${
                  tab === entry.id
                    ? "bg-accent-soft text-accent"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <entry.icon className="h-4 w-4" />
                {entry.label}
              </button>
            ))}
          </div>

          <div className="scroll-dark min-h-[280px] flex-1 overflow-y-auto p-4">
            {tab === "style" && (
              <div className="flex flex-col gap-3">
                <p className="text-[12px] leading-5 text-text-secondary">Choisis le style de rendu.</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {STYLES.map((style) => {
                    const selected = style.id === styleId;
                    return (
                      <button
                        key={style.id}
                        onClick={() => setConfirmStyle(style)}
                        className={`flex flex-col gap-2 rounded-[14px] border p-2 transition ${
                          selected
                            ? "border-accent-border bg-accent-soft/30"
                            : "border-border bg-surface-3 hover:border-accent"
                        }`}
                      >
                        <div className="relative aspect-square w-full overflow-hidden rounded-[10px] border border-border bg-surface-2">
                          <img
                            src={style.face}
                            alt={style.name}
                            className="h-full w-full object-cover"
                          />
                          {selected && (
                            <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-foreground">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <span className="truncate text-center text-[12px] font-bold text-text-primary">
                          {style.name}
                        </span>
                      </button>
                    );
                  })}
                  {customStyles.map((style) => {
                    const selected = style.id === styleId;
                    return (
                      <button
                        key={style.id}
                        onClick={() => setStyleId(style.id)}
                        className={`flex flex-col gap-2 rounded-[14px] border p-2 transition ${
                          selected ? "border-accent-border bg-accent-soft/30" : "border-border bg-surface-3 hover:border-accent"
                        }`}
                      >
                        <div className="relative aspect-square w-full overflow-hidden rounded-[10px] border border-border bg-surface-2">
                          <img src={style.images[0]} alt={style.name} className="h-full w-full object-cover" />
                          {selected && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="h-3 w-3" /></span>}
                        </div>
                        <span className="truncate text-center text-[12px] font-bold text-text-primary">{style.name}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setCreateStyleOpen(true)}
                    className="flex flex-col gap-2 rounded-[14px] border border-dashed border-border-strong bg-surface-3 p-2 transition hover:border-accent"
                  >
                    <span className="grid aspect-square w-full place-items-center rounded-[10px] border border-dashed border-border-strong bg-surface-2 text-text-secondary"><Plus className="h-6 w-6" /></span>
                    <span className="truncate text-center text-[12px] font-bold text-text-primary">Créer un style</span>
                  </button>
                </div>
              </div>
            )}

            {tab === "references" && (
              <ReferencesTab
                identityReference={identityReference}
                references={references}
                onImportIdentity={importIdentityReference}
                onRemoveIdentity={() => setIdentityReference(null)}
                onImport={importReferences}
                onUpdate={(id, patch) =>
                  setReferences((current) =>
                    current.map((reference) =>
                      reference.id === id ? { ...reference, ...patch } : reference,
                    ),
                  )
                }
                onRemove={(id) =>
                  setReferences((current) => current.filter((reference) => reference.id !== id))
                }
              />
            )}

            {tab === "prompt" && (
              <div className="flex flex-col gap-3">
                <p className="text-[12px] leading-5 text-text-secondary">
                  Décris ton personnage aussi précisément que possible.
                </p>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={10}
                  placeholder="Nom, âge, morphologie, cheveux, tenue, traits distinctifs, personnalité…"
                  className="w-full resize-none rounded-[14px] border border-border bg-input px-4 py-3 text-[14px] leading-relaxed text-text-primary placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <button
                  onClick={generate}
                  disabled={isGenerating || !identityReference?.imageDataUrl}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-accent px-4 text-[14px] font-bold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Wand2 className="h-4 w-4" />
                  {isGenerating ? "Génération…" : "Générer la carte personnage"}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT — result card */}
        <section className="shadow-panel flex min-w-0 flex-col rounded-[18px] border border-border bg-surface-2">
          <header className="flex items-center justify-between gap-2 border-b border-border p-4">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-accent" />
              <h2 className="truncate font-display text-base font-bold">Carte personnage</h2>
            </div>
            <button
              onClick={download}
              disabled={!result}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-2 text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          </header>

          <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
            <div
              className="relative overflow-hidden rounded-[10px] bg-artboard shadow-[0_30px_60px_-20px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.04)]"
              style={{ aspectRatio: "3 / 2", width: "100%", maxHeight: "100%" }}
            >
              {isGenerating ? (
                <GeneratingIndicator />
              ) : error ? (
                <div className="flex h-full flex-col items-center justify-center bg-[#f7faff] px-8 text-center text-[#0b1430]">
                  <X className="mb-4 h-10 w-10 text-danger" />
                  <p className="text-[15px] font-bold">Échec de la génération</p>
                  <p className="mt-2 max-w-[340px] text-[12px] leading-5 text-[#5e6a90]">{error}</p>
                </div>
              ) : result ? (
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  className="block h-full w-full cursor-zoom-in"
                  title="Voir en grand"
                >
                  <img
                    src={result.imageUrl}
                    alt="Carte personnage générée"
                    className="h-full w-full object-contain"
                  />
                </button>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#f7faff] px-8 text-center text-[#5e6a90]">
                  <ImageIcon className="h-10 w-10" />
                  <p className="text-[13px] font-semibold">
                    La carte (face / profil / dos + 6 expressions) apparaîtra ici.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {confirmStyle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(3,7,18,0.85)" }}
          onClick={() => setConfirmStyle(null)}
        >
          <div
            className="relative flex max-h-full w-full max-w-[720px] flex-col overflow-hidden rounded-[18px] border border-border bg-surface-2"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-2 border-b border-border p-4">
              <h2 className="font-display text-base font-bold">{confirmStyle.name}</h2>
              <button
                onClick={() => setConfirmStyle(null)}
                aria-label="Close"
                className="rounded-md p-1 text-text-muted hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="scroll-dark min-h-0 flex-1 overflow-y-auto p-4">
              <img
                src={confirmStyle.card}
                alt={`Carte ${confirmStyle.name}`}
                className="w-full rounded-[12px] object-contain"
                style={{ maxHeight: "60vh" }}
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border p-4">
              <button
                onClick={() => setConfirmStyle(null)}
                className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-border bg-surface-2 px-4 text-[13px] font-bold text-text-secondary hover:text-text-primary"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setStyleId(confirmStyle.id);
                  setConfirmStyle(null);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent-hover"
              >
                <Check className="h-4 w-4" />
                Confirmer ce style
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(3,7,18,0.85)" }}
          onClick={() => setLightbox(false)}
        >
          <div
            className="relative flex max-h-full w-full max-w-[1100px] flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setLightbox(false)}
              aria-label="Close"
              className="absolute -right-3 -top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-2 text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={result.imageUrl}
              alt="Carte personnage générée"
              className="w-full rounded-[14px] object-contain"
              style={{ maxHeight: "82vh" }}
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={download}
                className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent-hover"
              >
                <Download className="h-4 w-4" />
                Télécharger
              </button>
            </div>
          </div>
        </div>
      )}
      <CustomStyleModal
        open={createStyleOpen}
        onClose={() => setCreateStyleOpen(false)}
        onSaved={(style) => {
          setCustomStyles((current) => [style, ...current]);
          setStyleId(style.id);
        }}
      />
    </div>
  );
}

function ReferencesTab({
  identityReference,
  references,
  onImportIdentity,
  onRemoveIdentity,
  onImport,
  onUpdate,
  onRemove,
}: {
  identityReference: CharacterReference | null;
  references: CharacterReference[];
  onImportIdentity: (files: FileList | null) => void;
  onRemoveIdentity: () => void;
  onImport: (files: FileList | null) => void;
  onUpdate: (id: string, patch: Partial<CharacterReference>) => void;
  onRemove: (id: string) => void;
}) {
  const identityInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <input
        ref={identityInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          onImportIdentity(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <div className="rounded-[14px] border border-border bg-surface-3 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[13px] font-bold text-text-primary">Image d'identite</p>
            <p className="mt-0.5 text-[11px] text-text-muted">Obligatoire pour generer une carte.</p>
          </div>
          {identityReference && (
            <button
              onClick={onRemoveIdentity}
              aria-label="Supprimer l'image d'identite"
              className="rounded-md p-1 text-text-muted hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        {identityReference?.imageDataUrl ? (
          <button
            type="button"
            onClick={() => identityInputRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-[12px] border border-border bg-surface-2 p-2 text-left hover:border-accent"
          >
            <div className="h-[96px] w-[76px] shrink-0 overflow-hidden rounded-[10px] border border-border bg-surface-3">
              <img
                src={identityReference.imageDataUrl}
                alt={identityReference.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-text-primary">
                {identityReference.name}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-text-secondary">
                Cliquer pour remplacer.
              </p>
            </div>
          </button>
        ) : (
          <button
            onClick={() => identityInputRef.current?.click()}
            className="flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-border-strong bg-surface-2 px-3 text-text-primary hover:border-accent hover:text-accent"
          >
            <Upload className="h-5 w-5" />
            <span className="text-[13px] font-bold">Importer l'image d'identite</span>
          </button>
        )}
      </div>
      <p className="text-[12px] leading-5 text-text-secondary">
        Ajoute des références (tenue, accessoires, coiffure…) et précise à quoi elles servent.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          onImport(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex min-h-[64px] w-full flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-border-strong bg-surface-2 px-3 text-text-primary hover:border-accent hover:text-accent"
      >
        <Upload className="h-5 w-5" />
        <span className="text-[13px] font-bold">Importer des références</span>
      </button>

      {references.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border bg-surface-3/50 p-5 text-center">
          <ImagesIcon className="mx-auto mb-2 h-5 w-5 text-text-muted" />
          <p className="text-[13px] font-semibold text-text-secondary">Aucune référence</p>
        </div>
      ) : (
        references.map((reference) => (
          <div key={reference.id} className="rounded-[14px] border border-border bg-surface-3 p-3">
            <div className="flex gap-3">
              <div className="h-[76px] w-[60px] shrink-0 overflow-hidden rounded-[10px] border border-border bg-surface-2">
                {reference.imageDataUrl && (
                  <img
                    src={reference.imageDataUrl}
                    alt={reference.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-[13px] font-bold text-text-primary">{reference.name}</p>
                <button
                  onClick={() => onRemove(reference.id)}
                  aria-label="Supprimer"
                  className="mt-auto self-start rounded-md p-1 text-text-muted hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <textarea
              value={reference.description ?? ""}
              onChange={(event) => onUpdate(reference.id, { description: event.target.value })}
              rows={2}
              placeholder="À quoi sert cette référence ? (tenue, accessoire…)"
              className="mt-3 w-full resize-none rounded-[10px] border border-border bg-input px-3 py-2 text-[12px] leading-5 text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
            />
          </div>
        ))
      )}
    </div>
  );
}

function GeneratingIndicator() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#f7faff] px-8 text-center text-[#0b1430]">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-4 border-[#d7e0f4]" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#12b76a]" />
        <Sparkles className="absolute inset-0 m-auto h-6 w-6 animate-pulse text-[#12b76a]" />
      </div>
      <div>
        <p className="text-[15px] font-bold">Génération en cours</p>
        <p className="mt-1 text-[12px] text-[#5e6a90]">Composition de la carte personnage…</p>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-2 w-2 animate-bounce rounded-full bg-[#12b76a]"
            style={{ animationDelay: `${index * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
