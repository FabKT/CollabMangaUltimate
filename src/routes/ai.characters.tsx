import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { PageHeader, Panel, Input, SectionTitle } from "@/components/cma/Layout";
import {
  createBlankCharacter,
  createId,
  loadCharacterProfiles,
  saveCharacterProfiles,
  type MangaCharacterImage,
  type MangaCharacterProfile,
} from "@/lib/manga-workspace";
import { Check, ImageIcon, Plus, Save, Trash2, Upload, UserSquare2 } from "lucide-react";
import { recordGeneratedImage } from "@/lib/manga-history";
import { hasPendingGeneration, resumeDurableGeneration, runDurableGeneration } from "@/lib/durable-generation";
import type { CharacterImageResult } from "@/server-functions/character-image";

export const Route = createFileRoute("/ai/characters")({
  head: () => ({ meta: [{ title: "Character Studio - CollabManga AI" }] }),
  component: CharacterStudio,
});

const viewOptions = [
  "Front view",
  "Side profile",
  "Back view",
  "Three-quarter",
  "Expression sheet",
  "Outfit variation",
  "Accessory detail",
  "Color reference",
];

function fileBaseName(fileName: string) {
  return (
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || "Imported image"
  );
}

async function readCharacterImage(file: File, view: string): Promise<MangaCharacterImage> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image import failed."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<{ dataUrl: string; mimeType: string }>((resolve) => {
    const htmlImage = new Image();
    htmlImage.onload = () => {
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(htmlImage.width, htmlImage.height));
      if (scale >= 1 && file.size < 1_800_000) {
        resolve({ dataUrl: rawDataUrl, mimeType: file.type || "image/png" });
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(htmlImage.width * scale));
      canvas.height = Math.max(1, Math.round(htmlImage.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        resolve({ dataUrl: rawDataUrl, mimeType: file.type || "image/png" });
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(htmlImage, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.88), mimeType: "image/jpeg" });
    };
    htmlImage.onerror = () => resolve({ dataUrl: rawDataUrl, mimeType: file.type || "image/png" });
    htmlImage.src = rawDataUrl;
  });

  return {
    id: createId("character-image"),
    name: fileBaseName(file.name),
    view,
    imageDataUrl: image.dataUrl,
    mimeType: image.mimeType,
    notes: "",
    enabled: true,
  };
}

function CharacterStudio() {
  const [characters, setCharacters] = useState<MangaCharacterProfile[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [selectedView, setSelectedView] = useState(viewOptions[0]);
  const [isImporting, setIsImporting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadCharacterProfiles().then((savedCharacters) => {
      if (cancelled) return;
      setCharacters(savedCharacters);
      setActiveId(savedCharacters[0]?.id ?? "");
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const targetId = window.localStorage.getItem("collabmanga.ai-job.characters-card.target");
    if (!targetId || !hasPendingGeneration("characters-card")) return;
    setCardLoading(true);
    void resumeDurableGeneration<CharacterImageResult>("characters-card")
      .then((payload) => {
        if (!payload) return;
        const cardUrl = payload.imageDataUrl || payload.imageUrl;
        if (!cardUrl) return;
        setCharacters((current) => current.map((character) =>
          character.id === targetId
            ? { ...character, cardImageDataUrl: cardUrl, cardImageGeneratedAt: new Date().toISOString(), cardEnabled: true }
            : character,
        ));
        window.localStorage.removeItem("collabmanga.ai-job.characters-card.target");
      })
      .catch((error) => setCardError(error instanceof Error ? error.message : "Échec de la récupération de la carte."))
      .finally(() => setCardLoading(false));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void saveCharacterProfiles(characters).then((saved) => {
      if (!saved) setSaveState("error");
    });
  }, [characters, loaded]);

  useEffect(() => {
    if (saveState !== "saved" && saveState !== "error") return;
    const timeout = window.setTimeout(() => setSaveState("idle"), 1400);
    return () => window.clearTimeout(timeout);
  }, [saveState]);

  const activeCharacter = useMemo(
    () => characters.find((character) => character.id === activeId) ?? null,
    [activeId, characters],
  );

  const createCharacter = () => {
    const character = createBlankCharacter(characters.length + 1);
    setCharacters((current) => [...current, character]);
    setActiveId(character.id);
  };

  const updateActiveCharacter = (patch: Partial<MangaCharacterProfile>) => {
    if (!activeCharacter) return;
    setCharacters((current) =>
      current.map((character) =>
        character.id === activeCharacter.id ? { ...character, ...patch } : character,
      ),
    );
  };

  const deleteActiveCharacter = () => {
    if (!activeCharacter) return;
    setCharacters((current) => {
      const next = current.filter((character) => character.id !== activeCharacter.id);
      setActiveId(next[0]?.id ?? "");
      return next;
    });
  };

  const importFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;

    setIsImporting(true);
    try {
      const importedImages = await Promise.all(
        imageFiles.slice(0, 12).map((file) => readCharacterImage(file, selectedView)),
      );

      let target = activeCharacter;
      if (!target) {
        target = {
          ...createBlankCharacter(characters.length + 1),
          name: fileBaseName(imageFiles[0].name),
        };
        setActiveId(target.id);
      }

      const targetId = target.id;
      const createdTarget = target;
      setCharacters((current) => {
        const exists = current.some((character) => character.id === targetId);
        if (!exists) {
          return [{ ...createdTarget, images: importedImages }, ...current];
        }
        return current.map((character) =>
          character.id === targetId
            ? { ...character, images: [...(character.images ?? []), ...importedImages] }
            : character,
        );
      });
    } finally {
      setIsImporting(false);
    }
  };

  const updateImage = (imageId: string, patch: Partial<MangaCharacterImage>) => {
    if (!activeCharacter) return;
    updateActiveCharacter({
      images: (activeCharacter.images ?? []).map((image) =>
        image.id === imageId ? { ...image, ...patch } : image,
      ),
    });
  };

  const deleteImage = (imageId: string) => {
    if (!activeCharacter) return;
    updateActiveCharacter({
      images: (activeCharacter.images ?? []).filter((image) => image.id !== imageId),
    });
  };

  const saveNow = async () => {
    setSaveState("saving");
    const saved = await saveCharacterProfiles(characters);
    setSaveState(saved ? "saved" : "error");
  };

  const generateCard = async () => {
    if (!activeCharacter) return;
    const referenceImages = (activeCharacter.images ?? []).filter((image) => image.imageDataUrl);
    if (!referenceImages.length) {
      setCardError("Ajoute au moins une image de référence avant de générer la carte.");
      return;
    }
    setCardError(null);
    setCardLoading(true);
    try {
      const profileNotes = [
        activeCharacter.identityLock,
        activeCharacter.outfit,
        activeCharacter.accessories,
        activeCharacter.colorNotes,
        activeCharacter.personality,
      ]
        .filter(Boolean)
        .join(" | ");
      window.localStorage.setItem("collabmanga.ai-job.characters-card.target", activeCharacter.id);
      const payload = await runDurableGeneration<CharacterImageResult>(
        "characters-card",
        "/api/character/generate",
        {
          prompt: profileNotes,
          identityImageDataUrl: referenceImages[0].imageDataUrl,
          identityReferenceName: activeCharacter.name,
          styleId: "manga-bw",
          styleName: "Manga noir et blanc",
          styleDescription:
            "Encrage net, aplats noirs propres, trames légères si utiles, style planche manga noir et blanc.",
          references: referenceImages.slice(1).map((image) => ({
            id: image.id,
            name: image.name,
            imageDataUrl: image.imageDataUrl,
            mimeType: image.mimeType,
            description: image.notes,
          })),
        },
      );
      const cardUrl = payload.imageDataUrl || payload.imageUrl;
      if (!cardUrl) throw new Error("Le backend n'a renvoyé aucune carte.");
      void recordGeneratedImage({
        source: "Bibliotheque de personnages",
        title: activeCharacter.name,
        prompt: profileNotes,
        result: { ...payload, imageUrl: cardUrl },
      });
      updateActiveCharacter({
        cardImageDataUrl: cardUrl,
        cardImageGeneratedAt: new Date().toISOString(),
        cardEnabled: true,
      });
      window.localStorage.removeItem("collabmanga.ai-job.characters-card.target");
    } catch (error) {
      setCardError(error instanceof Error ? error.message : "Échec de la génération de carte.");
    } finally {
      setCardLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Character Studio"
        description="Create reusable profiles for Manga Page Creator."
        actions={
          <>
            <button className="cma-btn-secondary" onClick={createCharacter} type="button">
              <Plus size={16} /> New character
            </button>
            <button
              className="cma-btn-secondary"
              onClick={() => inputRef.current?.click()}
              disabled={isImporting}
              type="button"
            >
              <Upload size={16} /> {isImporting ? "Importing..." : "Import images"}
            </button>
            <button
              className="cma-btn-primary"
              onClick={() => void saveNow()}
              disabled={saveState === "saving"}
              type="button"
            >
              {saveState === "saved" ? <Check size={16} /> : <Save size={16} />}
              {saveState === "saving"
                ? "Saving..."
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                    ? "Save failed"
                    : "Save"}
            </button>
          </>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.currentTarget.files) void importFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(230px,0.75fr)_minmax(0,3.2fr)]">
        <Panel className="min-w-0" padding={16}>
          <SectionTitle
            right={
              <button
                className="cma-icon-btn"
                onClick={createCharacter}
                type="button"
                aria-label="New character"
              >
                <Plus size={15} />
              </button>
            }
          >
            Characters
          </SectionTitle>

          <div className="flex flex-col gap-2">
            {characters.length === 0 ? (
              <EmptyState icon={UserSquare2} title="No character yet" />
            ) : (
              characters.map((character) => (
                <button
                  key={character.id}
                  onClick={() => setActiveId(character.id)}
                  className="flex min-w-0 items-center gap-3 rounded-[14px] border p-3 text-left transition"
                  style={{
                    background: "var(--bg-elevated)",
                    borderColor:
                      character.id === activeId
                        ? "var(--neon-soft-border)"
                        : "var(--border-default)",
                    boxShadow: character.id === activeId ? "var(--shadow-neon)" : "none",
                  }}
                  type="button"
                >
                  <CharacterAvatar character={character} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{character.name}</p>
                    <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {(character.images ?? []).length} images
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </Panel>

        <Panel className="min-w-0">
          {!activeCharacter ? (
            <EmptyState icon={UserSquare2} title="Select or create a character" />
          ) : (
            <>
              {/* Nom du personnage — seul champ de détails conservé */}
              <div className="mb-6 flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <Field label="Nom du personnage">
                    <Input
                      value={activeCharacter.name}
                      onChange={(event) => updateActiveCharacter({ name: event.target.value })}
                      placeholder="Character name"
                    />
                  </Field>
                </div>
                <button
                  className="cma-icon-btn mb-0.5 shrink-0"
                  onClick={deleteActiveCharacter}
                  type="button"
                  aria-label="Delete character"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
                {/* SECTION GAUCHE — images du personnage */}
                <div
                  className="min-w-0"
                  onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                  onDrop={(event: DragEvent<HTMLDivElement>) => {
                    event.preventDefault();
                    void importFiles(event.dataTransfer.files);
                  }}
                >
                  <SectionTitle
                    right={
                      <select
                        value={selectedView}
                        onChange={(event) => setSelectedView(event.target.value)}
                        className="cma-input h-9 max-w-[190px] py-0 text-[12px] font-semibold"
                      >
                        {viewOptions.map((view) => (
                          <option key={view} value={view}>
                            {view}
                          </option>
                        ))}
                      </select>
                    }
                  >
                    Images du personnage
                  </SectionTitle>

                  <button
              onClick={() => inputRef.current?.click()}
              disabled={isImporting}
              className="mb-4 grid min-h-[118px] w-full place-items-center rounded-[16px] border border-dashed px-4 text-center transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: "var(--bg-stage)",
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
              }}
              type="button"
            >
              <span className="flex flex-col items-center gap-2">
                <Upload size={22} />
                <span className="text-[13px] font-bold">
                  {isImporting ? "Importing..." : "Import character references"}
                </span>
              </span>
            </button>

                  {(activeCharacter.images ?? []).length === 0 ? (
                    <EmptyState icon={ImageIcon} title="No reference image yet" />
                  ) : (
                    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                      {(activeCharacter.images ?? []).map((image) => (
                        <div
                          key={image.id}
                          className="min-w-0 rounded-[16px] border p-3 transition-opacity"
                          style={{
                            background: "var(--bg-elevated)",
                            borderColor:
                              image.enabled === false
                                ? "var(--border-default)"
                                : "var(--neon-soft-border)",
                            opacity: image.enabled === false ? 0.55 : 1,
                          }}
                        >
                          <div className="aspect-[3/4] overflow-hidden rounded-[12px] bg-black/20">
                            <img
                              src={image.imageDataUrl}
                              alt={image.name}
                              className="h-full w-full object-contain"
                            />
                          </div>
                          <div className="mt-3 grid gap-2">
                            <ToggleRow
                              label={image.enabled === false ? "Désactivée" : "Utilisée"}
                              checked={image.enabled !== false}
                              onChange={(checked) => updateImage(image.id, { enabled: checked })}
                            />
                            <Input
                              value={image.name}
                              onChange={(event) =>
                                updateImage(image.id, { name: event.target.value })
                              }
                              aria-label="Image name"
                            />
                            <select
                              value={image.view}
                              onChange={(event) =>
                                updateImage(image.id, { view: event.target.value })
                              }
                              className="cma-input h-10 py-0 text-[13px] font-semibold"
                            >
                              {viewOptions.map((view) => (
                                <option key={view} value={view}>
                                  {view}
                                </option>
                              ))}
                            </select>
                            <button
                              className="cma-btn-secondary w-full justify-center"
                              onClick={() => deleteImage(image.id)}
                              type="button"
                            >
                              <Trash2 size={15} /> Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SECTION DROITE — génération de la carte */}
                <div className="min-w-0">
                  <SectionTitle
                    right={
                      activeCharacter.cardImageDataUrl ? (
                        <ToggleRow
                          label={
                            activeCharacter.cardEnabled !== false
                              ? "Carte utilisée"
                              : "Carte désactivée"
                          }
                          checked={activeCharacter.cardEnabled !== false}
                          onChange={(checked) => updateActiveCharacter({ cardEnabled: checked })}
                        />
                      ) : null
                    }
                  >
                    Carte de personnage
                  </SectionTitle>

                  <div
                    className="rounded-[16px] border p-4"
                    style={{
                      background: "var(--bg-elevated)",
                      borderColor: "var(--border-default)",
                    }}
                  >
                    <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                      Consolide la bibliothèque en une seule image (profils + expressions), utilisée
                      comme référence unique dans la planche pour rester dans le budget de 16
                      images. Si la carte est désactivée, ce sont les images actives de la
                      bibliothèque qui sont envoyées.
                    </div>

                    <button
                      className="cma-btn-secondary mt-3 w-full justify-center"
                      type="button"
                      onClick={generateCard}
                      disabled={cardLoading || (activeCharacter.images ?? []).length === 0}
                    >
                      {cardLoading
                        ? "Génération..."
                        : activeCharacter.cardImageDataUrl
                          ? "Régénérer la carte"
                          : "Générer la carte"}
                    </button>

                    {cardError && (
                      <div className="mt-3 rounded-[10px] border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">
                        {cardError}
                      </div>
                    )}

                    {activeCharacter.cardImageDataUrl && (
                      <div className="mt-3">
                        <div
                          className="overflow-hidden rounded-[12px] bg-black/20 transition-opacity"
                          style={{
                            opacity: activeCharacter.cardEnabled === false ? 0.55 : 1,
                          }}
                        >
                          <img
                            src={activeCharacter.cardImageDataUrl}
                            alt="Carte de personnage"
                            className="w-full object-contain"
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                            {activeCharacter.cardImageGeneratedAt
                              ? `Générée le ${new Date(activeCharacter.cardImageGeneratedAt).toLocaleString()}`
                              : "Carte disponible"}
                          </span>
                          <button
                            type="button"
                            className="text-[12px] font-semibold text-danger"
                            onClick={() =>
                              updateActiveCharacter({
                                cardImageDataUrl: undefined,
                                cardImageGeneratedAt: undefined,
                                cardEnabled: true,
                              })
                            }
                          >
                            Supprimer la carte
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}

function CharacterAvatar({ character }: { character: MangaCharacterProfile }) {
  const image = character.images?.[0];
  return (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[12px] border"
      style={{
        background: "var(--bg-stage)",
        borderColor: "var(--border-default)",
        color: "var(--text-muted)",
      }}
    >
      {image ? (
        <img src={image.imageDataUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <UserSquare2 size={20} />
      )}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="cma-label mb-2">{label}</div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2"
    >
      <span
        className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors"
        style={{
          background: checked ? "var(--neon-soft)" : "var(--bg-stage)",
          borderColor: checked ? "var(--neon-soft-border)" : "var(--border-default)",
        }}
      >
        <span
          className="absolute h-3.5 w-3.5 rounded-full transition-all"
          style={{
            left: checked ? "calc(100% - 18px)" : "3px",
            background: checked ? "var(--neon)" : "var(--text-muted)",
          }}
        />
      </span>
      <span
        className="text-[12px] font-semibold"
        style={{ color: checked ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        {label}
      </span>
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
}) {
  return (
    <div
      className="rounded-[16px] border border-dashed p-5 text-center"
      style={{
        background: "var(--bg-stage)",
        borderColor: "var(--border-default)",
        color: "var(--text-secondary)",
      }}
    >
      <Icon size={22} className="mx-auto mb-2" />
      <p className="text-[13px] font-semibold">{title}</p>
    </div>
  );
}
