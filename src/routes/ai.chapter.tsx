import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Card, Label, Input, Textarea, Chip, SectionTitle } from "@/components/cma/Layout";
import { Sparkles, Plus, FileImage } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/ai/chapter")({
  head: () => ({ meta: [{ title: "Chapter Builder — CollabManga AI" }] }),
  component: ChapterBuilder,
});

function ChapterBuilder() {
  const { t } = useI18n();
  const toneLabels = [t("ai.toneTense"), t("ai.atmoHopeful"), t("ai.toneMelancholic"), t("ai.toneAction"), t("ai.atmoQuiet")];

  return (
    <>
      <PageHeader
        title={t("ai.chapterBuilder")}
        description={t("ai.chapterBuilderDesc")}
        actions={
          <>
            <button className="cma-btn-secondary">{t("ai.saveDraft")}</button>
            <button className="cma-btn-primary"><Sparkles size={16} /> {t("ai.generateOutline")}</button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-6">
        {/* Config */}
        <Panel>
          <SectionTitle>{t("ai.configuration")}</SectionTitle>
          <div className="flex flex-col gap-4">
            <div><Label>{t("ai.chapterTitle")}</Label><Input placeholder={t("ai.chapterTitlePlaceholder")} /></div>
            <div><Label>{t("ai.objectiveField")}</Label><Input placeholder={t("ai.objectivePlaceholder")} /></div>
            <div><Label>{t("ai.synopsisField")}</Label><Textarea placeholder={t("ai.synopsisPlaceholderShort")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("ai.pagesField")}</Label><Input type="number" defaultValue={18} /></div>
              <div><Label>{t("ai.pacing")}</Label><Input placeholder={t("ai.pacingPlaceholder")} /></div>
            </div>
            <div>
              <Label>{t("ai.emotionalTone")}</Label>
              <div className="flex flex-wrap gap-2">
                {toneLabels.map((label, i) => (
                  <Chip key={label} active={i === 0}>{label}</Chip>
                ))}
              </div>
            </div>
            <div><Label>{t("ai.charactersInvolved")}</Label><Input placeholder={t("ai.charactersInvolvedPlaceholder")} /></div>
            <div><Label>{t("ai.locationsField")}</Label><Input placeholder={t("ai.locationsPlaceholder")} /></div>
            <div><Label>{t("ai.keyBeats")}</Label><Textarea placeholder={t("ai.keyBeatsPlaceholder")} /></div>
            <div><Label>{t("ai.cliffhanger")}</Label><Textarea placeholder={t("ai.cliffhangerPlaceholder")} /></div>
          </div>
        </Panel>

        {/* Output */}
        <Panel>
          <SectionTitle right={<button className="cma-btn-ghost" style={{ height: 32, padding: "0 10px" }}><Plus size={14} /> {t("ai.addScene")}</button>}>
            {t("ai.chapterOutline")}
          </SectionTitle>

          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((s) => (
              <Card key={s}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("ai.scenePrefix")} {s}</div>
                    <div className="text-[15px] font-bold">{t("ai.untitledScene")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip>{t("ai.toneAction")}</Chip>
                    <Chip>3 {t("ai.pagesWord")}</Chip>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[1, 2, 3].map((p) => (
                    <div key={p} className="cma-card" style={{ padding: 12 }}>
                      <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("ai.pagePrefix")} {p}</div>
                      <div className="text-[13px] mt-1 font-bold">{t("ai.panelsAction")}</div>
                      <div className="aspect-[3/4] mt-2 grid place-items-center" style={{ background: "var(--bg-input)", borderRadius: 10 }}>
                        <FileImage size={20} style={{ color: "var(--text-muted)" }} />
                      </div>
                      <div className="text-[12px] mt-2" style={{ color: "var(--text-secondary)" }}>
                        {t("ai.dialogueNotesPlaceholder")}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
