import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { PageHeader, Panel, Input, Textarea, SectionTitle } from "@/components/cma/Layout";
import {
  createBlankCharacter,
  createId,
  loadCharacterProfiles,
  saveCharacterProfiles,
  type MangaCharacterImage,
  type MangaCharacterProfile,
} from "@/lib/manga-workspace";
import { Check, ImageIcon, Plus, Save, Trash2, Upload, UserSquare2 } from "lucide-react";

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
  };
}

function CharacterStudio() {
  const [characters, setCharacters] = useState<MangaCharacterProfile[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [selectedView, setSelectedView] = useState(viewOptions[0]);
  const [isImporting, setIsImporting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
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

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(230px,0.75fr)_minmax(0,1.3fr)_minmax(300px,0.95fr)]">
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
          <div
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
              Reference images
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

            {!activeCharacter ? (
              <EmptyState icon={ImageIcon} title="Create a character to add images" />
            ) : (activeCharacter.images ?? []).length === 0 ? (
              <EmptyState icon={ImageIcon} title="No reference image yet" />
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {(activeCharacter.images ?? []).map((image) => (
                  <div
                    key={image.id}
                    className="min-w-0 rounded-[16px] border p-3"
                    style={{
                      background: "var(--bg-elevated)",
                      borderColor: "var(--border-default)",
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
                      <Input
                        value={image.name}
                        onChange={(event) => updateImage(image.id, { name: event.target.value })}
                        aria-label="Image name"
                      />
                      <select
                        value={image.view}
                        onChange={(event) => updateImage(image.id, { view: event.target.value })}
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
        </Panel>

        <Panel className="min-w-0">
          <SectionTitle
            right={
              activeCharacter ? (
                <button
                  className="cma-icon-btn"
                  onClick={deleteActiveCharacter}
                  type="button"
                  aria-label="Delete character"
                >
                  <Trash2 size={15} />
                </button>
              ) : null
            }
          >
            Character details
          </SectionTitle>

          {!activeCharacter ? (
            <EmptyState icon={UserSquare2} title="Select or create a character" />
          ) : (
            <div className="flex flex-col gap-4">
              <Field label="Name">
                <Input
                  value={activeCharacter.name}
                  onChange={(event) => updateActiveCharacter({ name: event.target.value })}
                  placeholder="Character name"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Age">
                  <Input
                    value={activeCharacter.age ?? ""}
                    onChange={(event) => updateActiveCharacter({ age: event.target.value })}
                    placeholder="18"
                  />
                </Field>
                <Field label="Height">
                  <Input
                    value={activeCharacter.height ?? ""}
                    onChange={(event) => updateActiveCharacter({ height: event.target.value })}
                    placeholder="172 cm"
                  />
                </Field>
              </div>

              <Field label="Narrative role">
                <Input
                  value={activeCharacter.storyRole}
                  onChange={(event) => updateActiveCharacter({ storyRole: event.target.value })}
                  placeholder="Hero, rival, mentor..."
                />
              </Field>

              <Field label="Identity lock">
                <Textarea
                  value={activeCharacter.identityLock}
                  onChange={(event) => updateActiveCharacter({ identityLock: event.target.value })}
                  placeholder="Face, hair, silhouette, outfit details..."
                />
              </Field>

              <Field label="Default expression">
                <Textarea
                  value={activeCharacter.defaultExpression}
                  onChange={(event) =>
                    updateActiveCharacter({ defaultExpression: event.target.value })
                  }
                  placeholder="Usual emotion, gaze, posture..."
                  style={{ minHeight: 86 }}
                />
              </Field>

              <Field label="Body proportions">
                <Input
                  value={activeCharacter.bodyProportions ?? ""}
                  onChange={(event) =>
                    updateActiveCharacter({ bodyProportions: event.target.value })
                  }
                  placeholder="Lean, athletic, tall..."
                />
              </Field>

              <Field label="Outfit">
                <Textarea
                  value={activeCharacter.outfit ?? ""}
                  onChange={(event) => updateActiveCharacter({ outfit: event.target.value })}
                  placeholder="Primary outfit..."
                />
              </Field>

              <Field label="Accessories">
                <Input
                  value={activeCharacter.accessories ?? ""}
                  onChange={(event) => updateActiveCharacter({ accessories: event.target.value })}
                  placeholder="Earring, scarf..."
                />
              </Field>

              <Field label="Color notes">
                <Input
                  value={activeCharacter.colorNotes ?? ""}
                  onChange={(event) => updateActiveCharacter({ colorNotes: event.target.value })}
                  placeholder="Black hair, jade eyes..."
                />
              </Field>

              <Field label="Personality">
                <Textarea
                  value={activeCharacter.personality ?? ""}
                  onChange={(event) => updateActiveCharacter({ personality: event.target.value })}
                  placeholder="Temperament, habits, voice..."
                />
              </Field>
            </div>
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
