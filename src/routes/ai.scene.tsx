import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Card, Label, Input, Textarea, Chip, SectionTitle } from "@/components/cma/Layout";
import { Plus, Image as ImageIcon, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/ai/scene")({
  head: () => ({ meta: [{ title: "Scene Builder — CollabManga AI" }] }),
  component: SceneBuilder,
});

function SceneBuilder() {
  const { t } = useI18n();
  const atmoLabels = [t("ai.atmoCinematic"), t("ai.atmoQuiet"), t("ai.atmoOppressive"), t("ai.atmoHopeful")];
  return (
    <>
      <PageHeader
        title={t("ai.sceneBuilder")}
        description={t("ai.sceneBuilderDesc")}
        actions={
          <>
            <button className="cma-btn-secondary">{t("ai.saveScene")}</button>
            <button className="cma-btn-primary"><Sparkles size={16} /> {t("ai.generatePreview")}</button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6">
        <Panel>
          <SectionTitle>{t("ai.sceneDefinition")}</SectionTitle>
          <div className="flex flex-col gap-4">
            <div><Label>{t("ai.location")}</Label><Input placeholder={t("ai.locationPlaceholder")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("ai.timeOfDay")}</Label><Input placeholder={t("ai.dusk")} /></div>
              <div><Label>{t("ai.weather")}</Label><Input placeholder={t("ai.lightRain")} /></div>
            </div>
            <div>
              <Label>{t("ai.atmosphere")}</Label>
              <div className="flex flex-wrap gap-2">
                {atmoLabels.map((label, i) => (<Chip key={label} active={i === 0}>{label}</Chip>))}
              </div>
            </div>
            <div><Label>{t("ai.charactersPresent")}</Label><Input placeholder={t("ai.charactersPresentPlaceholder")} /></div>
            <div><Label>{t("ai.characterPositions")}</Label><Textarea placeholder={t("ai.characterPositionsPlaceholder")} /></div>
            <div><Label>{t("ai.mainAction")}</Label><Textarea placeholder={t("ai.mainActionPlaceholder")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("ai.cameraAngle")}</Label><Input placeholder={t("ai.cameraAnglePlaceholder")} /></div>
              <div><Label>{t("ai.emotionalIntensity")}</Label><Input placeholder={t("ai.emotionalIntensityPlaceholder")} /></div>
            </div>
            <div><Label>{t("ai.keyProps")}</Label><Input placeholder={t("ai.keyPropsPlaceholder")} /></div>
            <div><Label>{t("ai.backgroundDetails")}</Label><Textarea placeholder={t("ai.backgroundDetailsPlaceholder")} /></div>
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel>
            <SectionTitle>{t("ai.preview")}</SectionTitle>
            <div className="aspect-[16/9] grid place-items-center" style={{ background: "var(--bg-stage)", borderRadius: 14, border: "1px dashed var(--border-default)" }}>
              <ImageIcon size={28} style={{ color: "var(--text-muted)" }} />
            </div>
          </Panel>

          <Panel>
            <SectionTitle right={<button className="cma-btn-ghost" style={{ height: 32, padding: "0 10px" }}><Plus size={14} /> {t("ai.newScene")}</button>}>
              {t("ai.savedScenes")}
            </SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} padding={12} selected={i === 0}>
                  <div className="aspect-[16/10] grid place-items-center mb-3" style={{ background: "var(--bg-input)", borderRadius: 10 }}>
                    <ImageIcon size={20} style={{ color: "var(--text-muted)" }} />
                  </div>
                  <div className="text-[13px] font-bold">{t("ai.scenePrefix")} {i + 1}</div>
                  <div className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>{t("ai.sceneMetaExample")}</div>
                </Card>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
