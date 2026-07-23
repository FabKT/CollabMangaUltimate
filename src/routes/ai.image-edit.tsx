import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  ImageIcon,
  Images,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Wand2,
} from "lucide-react";
import { PageHeader, Panel, Textarea } from "@/components/cma/Layout";
import {
  hasPendingGeneration,
  resumeDurableGeneration,
  runDurableGeneration,
} from "@/lib/durable-generation";
import {
  IMAGE_EDIT_SESSION_KEY,
  type ImageEditDraft,
  type ImageEditReference,
  type ImageEditReferenceRole,
} from "@/lib/image-edit-workspace";
import { notifyCreditsChanged } from "@/lib/credits-events";
import { recordGeneratedImage } from "@/lib/manga-history";
import { loadSession, saveSession } from "@/lib/manga-session";
import { createId, loadCharacterProfiles, type MangaCharacterProfile } from "@/lib/manga-workspace";
import type {
  MangaImageGenerationInput,
  MangaImageGenerationResult,
} from "@/server-functions/manga-image";

export const Route = createFileRoute("/ai/image-edit")({
  head: () => ({ meta: [{ title: "Modification d'image - CollabManga AI" }] }),
  component: ImageEditPage,
});

type EditorTab = "image" | "characters" | "references" | "prompt";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(file);
  });
}

async function readTargetImage(file: File) {
  const dataUrl = await fileToDataUrl(file);
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Impossible de lire les dimensions de l'image."));
    image.src = dataUrl;
  });

  return {
    dataUrl,
    aspectRatio: dimensions.width >= dimensions.height ? ("3:2" as const) : ("2:3" as const),
  };
}

const referenceRoles: Array<{ value: ImageEditReferenceRole; label: string }> = [
  { value: "Inspiration", label: "Inspiration ciblée" },
  { value: "Pose", label: "Pose" },
  { value: "Style", label: "Style" },
  { value: "Background", label: "Décor" },
  { value: "Object", label: "Objet" },
  { value: "Storyboard", label: "Structure" },
  { value: "Target", label: "Cible précise" },
];

function downloadImage(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = `collabmanga-edit-${Date.now()}.png`;
  link.click();
}

function characterThumbnail(character: MangaCharacterProfile) {
  return character.cardImageDataUrl || character.images?.[0]?.imageDataUrl;
}

function ImageEditPage() {
  const [draft, setDraft] = useState<ImageEditDraft | null>(null);
  const [characters, setCharacters] = useState<MangaCharacterProfile[]>([]);
  const [tab, setTab] = useState<EditorTab>("image");
  const [result, setResult] = useState<MangaImageGenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const targetUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.all([
      loadSession<ImageEditDraft>(IMAGE_EDIT_SESSION_KEY),
      loadCharacterProfiles(),
    ]).then(([saved, profiles]) => {
      setDraft(saved);
      setCharacters(profiles);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!hasPendingGeneration(IMAGE_EDIT_SESSION_KEY)) return;
    setIsGenerating(true);
    void resumeDurableGeneration<MangaImageGenerationResult>(IMAGE_EDIT_SESSION_KEY)
      .then((generated) => {
        if (!generated) return;
        setResult(generated);
        setDraft((current) =>
          current ? { ...current, currentImageUrl: generated.imageUrl } : current,
        );
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Image modification failed."),
      )
      .finally(() => setIsGenerating(false));
  }, []);

  useEffect(() => {
    if (!loaded || !draft) return;
    void saveSession(IMAGE_EDIT_SESSION_KEY, draft);
  }, [draft, loaded]);

  const selectedCharacters = useMemo(
    () => characters.filter((character) => draft?.selectedCharacterIds.includes(character.id)),
    [characters, draft?.selectedCharacterIds],
  );

  const toggleCharacter = (id: string) => {
    setDraft((current) => {
      if (!current) return current;
      const selected = current.selectedCharacterIds.includes(id);
      return {
        ...current,
        selectedCharacterIds: selected
          ? current.selectedCharacterIds.filter((value) => value !== id)
          : [...current.selectedCharacterIds, id],
      };
    });
  };

  const importReferences = async (files: FileList | null) => {
    const images = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!images.length) return;
    const imported = await Promise.all(
      images.map(async (file): Promise<ImageEditReference> => ({
        id: createId("edit-reference"),
        name: file.name.replace(/\.[^.]+$/, "") || "Reference",
        imageDataUrl: await fileToDataUrl(file),
        mimeType: file.type || undefined,
        role: "Inspiration",
      })),
    );
    setDraft((current) =>
      current ? { ...current, references: [...current.references, ...imported] } : current,
    );
  };

  const importTargetImage = async (files: FileList | null) => {
    const file = Array.from(files ?? []).find((candidate) => candidate.type.startsWith("image/"));
    if (!file) return;

    setError(null);
    try {
      const imported = await readTargetImage(file);
      setResult(null);
      setDraft((current) => ({
        originalImageUrl: imported.dataUrl,
        currentImageUrl: imported.dataUrl,
        prompt: current?.prompt ?? "",
        selectedCharacterIds: current?.selectedCharacterIds ?? [],
        references: current?.references ?? [],
        aspectRatio: imported.aspectRatio,
        source: file.name,
      }));
      setTab("image");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Image import failed.");
    }
  };

  const modifyImage = async () => {
    if (!draft?.currentImageUrl || !draft.prompt.trim()) return;
    setError(null);
    setIsGenerating(true);
    try {
      const characterAssets = selectedCharacters.flatMap((character) => {
        if (character.cardImageDataUrl && character.cardEnabled !== false) {
          return [
            {
              id: `${character.id}-card`,
              name: `${character.name} character card`,
              role: "Character" as const,
              imageDataUrl: character.cardImageDataUrl,
              characterId: character.id,
              characterName: character.name,
              characterProfile: [
                character.storyRole,
                character.identityLock,
                character.defaultExpression,
              ]
                .filter(Boolean)
                .join(" | "),
            },
          ];
        }
        return (character.images ?? [])
          .filter((image) => image.enabled !== false)
          .map((image) => ({
            id: image.id,
            name: image.name,
            role: "Character" as const,
            imageDataUrl: image.imageDataUrl,
            mimeType: image.mimeType,
            characterId: character.id,
            characterName: character.name,
            characterProfile: [
              character.storyRole,
              character.identityLock,
              character.defaultExpression,
            ]
              .filter(Boolean)
              .join(" | "),
            description: image.notes,
          }));
      });
      const payload: MangaImageGenerationInput = {
        operation: "edit",
        prompt: draft.prompt,
        editPrompt: draft.prompt,
        editScope: "full",
        activePage: 1,
        pages: [1],
        panelCount: 1,
        panelInstructions: [],
        selectedAssets: [
          ...characterAssets,
          ...draft.references.map((reference) => ({
            id: reference.id,
            name: reference.name,
            role: reference.role ?? ("Inspiration" as const),
            imageDataUrl: reference.imageDataUrl,
            mimeType: reference.mimeType,
            description: reference.description,
          })),
        ],
        characters: selectedCharacters.map((character) => ({
          id: character.id,
          name: character.name,
          storyRole: character.storyRole,
          identityLock: character.identityLock,
          defaultExpression: character.defaultExpression,
        })),
        styleMode: "auto",
        backgroundLevel: "auto",
        readingDirection: "right-to-left",
        aspectRatio: draft.aspectRatio,
        existingImageDataUrl: draft.currentImageUrl,
      };
      const generated = await runDurableGeneration<MangaImageGenerationResult>(
        IMAGE_EDIT_SESSION_KEY,
        "/api/manga/generate-page",
        payload,
      );
      const nextDraft = { ...draft, currentImageUrl: generated.imageUrl };
      setResult(generated);
      setDraft(nextDraft);
      notifyCreditsChanged();
      void recordGeneratedImage({
        source: "Modification d'image",
        title: "Image modifiée",
        prompt: draft.prompt,
        result: generated,
        editContext: nextDraft,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Image modification failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!loaded) return <div className="py-20 text-center text-text-muted">Loading...</div>;
  if (!draft) {
    return (
      <>
        <PageHeader
          title="Modification d'image"
          description="Importez une image ou ouvrez une génération depuis l'historique."
        />
        <Panel className="mx-auto max-w-2xl py-16 text-center">
          <input
            ref={targetUploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void importTargetImage(event.target.files);
              event.currentTarget.value = "";
            }}
          />
          <ImageIcon className="mx-auto h-10 w-10 text-accent" />
          <h1 className="mt-4 text-xl font-bold">Importer l'image à modifier</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Cette image devient la cible principale et reste verrouillée hors des changements
            demandés.
          </p>
          {error && (
            <p className="mt-4 rounded-[10px] border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => targetUploadRef.current?.click()}
              className="cma-btn-primary"
            >
              <Upload className="h-4 w-4" /> Importer une image
            </button>
            <Link to="/ai/history" className="cma-btn-secondary">
              Ouvrir l'historique
            </Link>
          </div>
        </Panel>
      </>
    );
  }

  const tabs: Array<{ id: EditorTab; label: string; icon: typeof ImageIcon }> = [
    { id: "image", label: "Image", icon: ImageIcon },
    { id: "characters", label: "Personnages", icon: UserRound },
    { id: "references", label: "Références", icon: Images },
    { id: "prompt", label: "Prompt", icon: Sparkles },
  ];
  const portrait = draft.aspectRatio === "2:3";

  return (
    <>
      <PageHeader
        title="Modification d'image"
        description="Conservez l'image et ses références, puis décrivez uniquement les changements souhaités."
      />
      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel padding={0} className="min-w-0 overflow-hidden">
          <div className="scroll-dark m-2 flex overflow-x-auto rounded-[14px] border border-border bg-surface-3 p-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-[10px] px-3 text-[12px] font-bold transition ${
                  tab === id
                    ? "bg-accent-soft text-accent shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div className="min-h-[560px] p-5">
            {tab === "image" && (
              <div>
                <input
                  ref={targetUploadRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    void importTargetImage(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="truncate text-xs text-text-muted">
                    {draft.source || "Image cible"}
                  </p>
                  <button
                    type="button"
                    onClick={() => targetUploadRef.current?.click()}
                    className="cma-btn-secondary shrink-0"
                  >
                    <Upload className="h-4 w-4" /> Remplacer
                  </button>
                </div>
                <div className="flex h-full min-h-[470px] items-center justify-center rounded-[16px] bg-stage p-4">
                  <img
                    src={draft.currentImageUrl}
                    alt="Image à modifier"
                    className="max-h-[470px] max-w-full rounded-[10px] object-contain"
                  />
                </div>
              </div>
            )}

            {tab === "characters" && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {characters.map((character) => {
                  const selected = draft.selectedCharacterIds.includes(character.id);
                  const thumbnail = characterThumbnail(character);
                  return (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => toggleCharacter(character.id)}
                      className={`relative overflow-hidden rounded-[12px] border p-2 text-left ${
                        selected ? "border-accent bg-accent-soft" : "border-border bg-surface-2"
                      }`}
                    >
                      <div className="aspect-square overflow-hidden rounded-[9px] bg-stage">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={character.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full place-items-center">
                            <UserRound className="text-text-muted" />
                          </div>
                        )}
                      </div>
                      <p className="mt-2 truncate text-[12px] font-bold">{character.name}</p>
                      {selected && (
                        <Check className="absolute right-3 top-3 h-5 w-5 rounded-full bg-accent p-0.5 text-accent-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {tab === "references" && (
              <div>
                <input
                  ref={uploadRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void importReferences(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => uploadRef.current?.click()}
                  className="cma-btn-secondary w-full justify-center"
                >
                  <Upload className="h-4 w-4" /> Importer des références
                </button>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {draft.references.map((reference) => (
                    <div
                      key={reference.id}
                      className="relative overflow-hidden rounded-[12px] border border-border bg-surface-2 p-2"
                    >
                      <div className="aspect-square overflow-hidden rounded-[9px] bg-stage p-1">
                        <img
                          src={reference.imageDataUrl}
                          alt={reference.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <p className="mt-2 truncate text-[11px] font-bold">{reference.name}</p>
                      <select
                        aria-label={`Rôle de ${reference.name}`}
                        value={reference.role ?? "Inspiration"}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  references: current.references.map((item) =>
                                    item.id === reference.id
                                      ? {
                                          ...item,
                                          role: event.target.value as ImageEditReferenceRole,
                                        }
                                      : item,
                                  ),
                                }
                              : current,
                          )
                        }
                        className="mt-2 h-9 w-full rounded-[8px] border border-border bg-surface px-2 text-[11px] text-text-primary outline-none focus:border-accent"
                      >
                        {referenceRoles.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      <textarea
                        aria-label={`Consignes pour ${reference.name}`}
                        value={reference.description ?? ""}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  references: current.references.map((item) =>
                                    item.id === reference.id
                                      ? { ...item, description: event.target.value }
                                      : item,
                                  ),
                                }
                              : current,
                          )
                        }
                        placeholder="Éléments précis à reprendre..."
                        rows={2}
                        className="mt-2 w-full resize-none rounded-[8px] border border-border bg-surface px-2 py-2 text-[11px] text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
                      />
                      <button
                        type="button"
                        aria-label="Supprimer"
                        onClick={() =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  references: current.references.filter(
                                    (item) => item.id !== reference.id,
                                  ),
                                }
                              : current,
                          )
                        }
                        className="absolute right-3 top-3 rounded-[8px] bg-black/70 p-1.5 text-white"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "prompt" && (
              <div>
                <label className="cma-label mb-2 block">Modifications demandées</label>
                <Textarea
                  value={draft.prompt}
                  onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
                  placeholder="Décrivez précisément ce qui doit changer et ce qui doit rester identique..."
                  style={{ minHeight: 360 }}
                />
              </div>
            )}
          </div>
        </Panel>

        <Panel className="flex min-h-[640px] min-w-0 flex-col">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-bold">Nouvelle image</h2>
            {result && (
              <button
                type="button"
                onClick={() => downloadImage(result.imageUrl)}
                className="cma-icon-btn"
                aria-label="Download"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden rounded-[18px] bg-stage p-4">
            <div
              className="relative grid max-h-[600px] max-w-full place-items-center overflow-hidden rounded-[10px] bg-artboard"
              style={{
                aspectRatio: portrait ? "2 / 3" : "3 / 2",
                width: portrait ? "auto" : "100%",
                height: portrait ? "100%" : "auto",
              }}
            >
              {isGenerating ? (
                <div className="flex flex-col items-center gap-3 text-center text-text-secondary">
                  <Sparkles className="h-8 w-8 animate-pulse text-accent" />
                  <span className="text-sm font-bold">Modification en cours...</span>
                </div>
              ) : result ? (
                <img
                  src={result.imageUrl}
                  alt="Image modifiée"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="px-8 text-center text-sm text-text-muted">
                  La nouvelle image apparaîtra ici.
                </div>
              )}
            </div>
          </div>
          {error && (
            <p className="mt-3 rounded-[10px] border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void modifyImage()}
            disabled={isGenerating || !draft.prompt.trim()}
            className="cma-btn-primary mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" /> {result ? "Modifier à nouveau" : "Modifier l'image"}
          </button>
        </Panel>
      </div>
    </>
  );
}
