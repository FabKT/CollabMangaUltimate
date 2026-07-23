import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, Card, Input, Chip, SectionTitle } from "@/components/cma/Layout";
import { Search, Plus, Copy, Sparkles } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/ai/prompts")({
  head: () => ({ meta: [{ title: "Prompt Library — CollabManga AI" }] }),
  component: PromptLibrary,
});

const CAT_KEYS: TranslationKey[] = ["ai.catAll", "ai.catPageGen", "ai.catCharacterDesign", "ai.catSceneComposition", "ai.catDialogue", "ai.catActionSequence", "ai.catStyle", "ai.catCorrection"];

function PromptLibrary() {
  const { t } = useI18n();
  const [cat, setCat] = useState(0);
  const cats = CAT_KEYS.map((key) => t(key));

  return (
    <>
      <PageHeader
        title={t("ai.promptLibrary")}
        description={t("ai.promptLibraryDesc")}
        actions={<button className="cma-btn-primary"><Plus size={16} /> {t("ai.createPrompt")}</button>}
      />

      <Panel className="mb-6">
        <div className="relative">
          <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <Input placeholder={t("ai.searchPrompts")} style={{ paddingLeft: 38 }} />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {cats.map((c, i) => (<Chip key={c} active={i === cat} onClick={() => setCat(i)}>{c}</Chip>))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} padding={20}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {cats[(i % (cats.length - 1)) + 1]}
                </div>
                <div className="text-[15px] font-bold mt-1">{t("ai.promptPreset")} {i + 1}</div>
              </div>
              <Sparkles size={16} color="var(--neon)" />
            </div>
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {t("ai.promptPreview")}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {["#dynamic", "#rain", "#close-up"].map((tag) => <Chip key={tag}>{tag}</Chip>)}
            </div>
            <div className="flex items-center justify-between mt-5">
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("ai.usedPrefix")} 000 {t("ai.timesSuffix")}</span>
              <div className="flex items-center gap-2">
                <button className="cma-icon-btn" aria-label="Copy"><Copy size={14} /></button>
                <button className="cma-btn-secondary" style={{ height: 36, padding: "0 14px" }}>{t("ai.use")}</button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
