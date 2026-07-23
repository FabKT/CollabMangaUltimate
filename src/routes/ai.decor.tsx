import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/cma/Layout";
import { loadCreatedDecors, removeCreatedDecor, type CreatedDecor } from "@/lib/decor-store";
import { ImagePlus, ImageIcon, Trash2 } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/ai/decor")({
  head: () => ({ meta: [{ title: "Bibliothèque de décors — CollabManga AI" }] }),
  component: DecorLibraryPage,
});

type DecorCard = { id: string; name: string; imageUrl?: string };
type DecorCategory = { id: string; name: string; decors: DecorCard[] };

function baseDecors(prefix: string, names: string[]): DecorCard[] {
  return names.map((name, index) => ({ id: `${prefix}-${index}`, name }));
}

const BASE_CATEGORIES: DecorCategory[] = [
  {
    id: "sport",
    name: "Sport",
    decors: baseDecors("sport", [
      "Terrain de foot",
      "Terrain de basket",
      "Terrain de volley",
      "Terrain de tennis",
      "Piste d'athlétisme",
      "Ring de boxe",
      "Piscine olympique",
      "Gymnase",
      "Dojo",
      "Skatepark",
    ]),
  },
  {
    id: "forests",
    name: "Forêts",
    decors: baseDecors("forest", [
      "Forêt dense",
      "Forêt de bambous",
      "Clairière ensoleillée",
      "Jungle tropicale",
      "Forêt enneigée",
      "Forêt d'automne",
      "Forêt de pins",
      "Sous-bois",
    ]),
  },
  {
    id: "plains",
    name: "Plaines",
    decors: baseDecors("plain", [
      "Plaine herbeuse",
      "Prairie fleurie",
      "Champ de blé",
      "Savane",
      "Steppe",
      "Colline verdoyante",
    ]),
  },
  {
    id: "cities",
    name: "Villes",
    decors: baseDecors("city", [
      "Rue moderne",
      "Ruelle japonaise",
      "Quartier néon",
      "Centre-ville",
      "Marché animé",
      "Toits de la ville",
      "Gare",
      "Zone portuaire",
    ]),
  },
  {
    id: "castles",
    name: "Châteaux",
    decors: baseDecors("castle", [
      "Château médiéval",
      "Salle du trône",
      "Donjon",
      "Château japonais",
      "Remparts",
      "Cour intérieure",
      "Château hanté",
    ]),
  },
];

const CREATED_ID = "created";

const CATEGORY_NAME_KEYS: Record<string, TranslationKey> = {
  sport: "ai.catSport",
  forests: "ai.catForests",
  plains: "ai.catPlains",
  cities: "ai.catCities",
  castles: "ai.catCastles",
  [CREATED_ID]: "ai.catCreatedDecors",
};

function DecorLibraryPage() {
  const { t } = useI18n();
  const [created, setCreated] = useState<CreatedDecor[]>([]);
  const [active, setActive] = useState<string>("all");

  useEffect(() => {
    void loadCreatedDecors().then(setCreated);
  }, []);

  const removeCreated = (id: string) => {
    void removeCreatedDecor(id);
    setCreated((current) => current.filter((decor) => decor.id !== id));
  };

  const categories: DecorCategory[] = [
    ...BASE_CATEGORIES,
    {
      id: CREATED_ID,
      name: "Décors créés",
      decors: created.map((decor) => ({ id: decor.id, name: decor.name, imageUrl: decor.imageUrl })),
    },
  ];

  const chips = [{ id: "all", name: t("ai.all") }, ...categories.map((c) => ({ id: c.id, name: t(CATEGORY_NAME_KEYS[c.id]) }))];
  const shown = categories.filter((category) => active === "all" || category.id === active);

  return (
    <div className="manga-canvas-page w-full min-w-0 text-text-primary">
      <PageHeader
        title={t("ai.decorLibrary")}
        description={t("ai.decorLibraryDesc")}
        actions={
          <Link
            to="/ai/decor-create"
            className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent-hover"
          >
            <ImagePlus size={16} /> {t("ai.createDecor")}
          </Link>
        }
      />

      {/* Category filter */}
      <div className="scroll-dark mb-5 flex flex-wrap gap-2">
        {chips.map((chip) => {
          const selected = active === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setActive(chip.id)}
              className={`h-8 rounded-full border px-3 text-[12px] font-bold transition ${
                selected
                  ? "border-accent-border bg-accent-soft text-accent"
                  : "border-border bg-surface-2 text-text-secondary hover:text-text-primary"
              }`}
            >
              {chip.name}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-8">
        {shown.map((category) => (
          <section key={category.id}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-display text-base font-bold">{t(CATEGORY_NAME_KEYS[category.id])}</h2>
              <span className="rounded-full border border-border bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                {category.decors.length}
              </span>
            </div>

            {category.decors.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-border bg-surface-2/40 p-8 text-center">
                <ImageIcon className="mx-auto mb-2 h-6 w-6 text-text-muted" />
                <p className="text-[13px] font-semibold text-text-secondary">
                  {t("ai.noDecorCreatedYet")}
                </p>
                <Link
                  to="/ai/decor-create"
                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-[10px] border border-border bg-surface-2 px-3 text-[12px] font-bold text-text-primary hover:border-accent hover:text-accent"
                >
                  <ImagePlus size={14} /> {t("ai.createDecor")}
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {category.decors.map((decor) => (
                  <DecorLibraryCard
                    key={decor.id}
                    decor={decor}
                    onRemove={
                      category.id === CREATED_ID ? () => removeCreated(decor.id) : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function DecorLibraryCard({
  decor,
  onRemove,
}: {
  decor: DecorCard;
  onRemove?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="group flex flex-col gap-2 rounded-[14px] border border-border bg-surface-2 p-2">
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[10px] border border-border bg-surface-3">
        {decor.imageUrl ? (
          <img src={decor.imageUrl} alt={decor.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" />
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            aria-label={t("ai.remove")}
            className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white/80 opacity-0 transition hover:text-danger group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <span className="truncate px-1 text-center text-[12px] font-bold text-text-primary">
        {decor.name}
      </span>
    </div>
  );
}
