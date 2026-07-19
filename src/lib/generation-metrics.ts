import { getServiceSupabase } from "./stripe-server";

export type GenerationUsage = {
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: {
    text_tokens?: number;
    image_tokens?: number;
  };
};

type MetricResult = {
  model?: string;
  size?: string;
  quality?: string;
  costUsd?: number;
  usage?: GenerationUsage;
};

type MetricInput = {
  userId: string | null;
  workspace: string;
  operationType: string;
  result: MetricResult;
};

const GPT_IMAGE_2_OUTPUT_PRICES: Record<string, Record<string, number>> = {
  low: { square: 0.006, portrait: 0.005, landscape: 0.005 },
  medium: { square: 0.053, portrait: 0.041, landscape: 0.041 },
  high: { square: 0.211, portrait: 0.165, landscape: 0.165 },
};

function orientation(size?: string) {
  const match = size?.match(/^(\d+)x(\d+)$/);
  if (!match) return "portrait";
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

export function estimateImageOutputCostUsd(result: MetricResult) {
  const model = (result.model ?? "gpt-image-2").toLowerCase();
  const quality = (result.quality ?? "high").toLowerCase();
  if (!model.includes("gpt-image-2")) return null;
  return GPT_IMAGE_2_OUTPUT_PRICES[quality]?.[orientation(result.size)] ?? null;
}

export async function recordGenerationMetric(input: MetricInput) {
  const reportedCost = Number(input.result.costUsd);
  const hasReportedCost = Number.isFinite(reportedCost) && reportedCost >= 0;
  const estimatedCost = estimateImageOutputCostUsd(input.result);
  const costUsd = hasReportedCost ? reportedCost : estimatedCost;

  try {
    await getServiceSupabase()
      .from("ai_generation_metrics")
      .insert({
        user_id: input.userId,
        workspace: input.workspace,
        operation_type: input.operationType,
        model: input.result.model ?? "gpt-image-2",
        quality: input.result.quality ?? "high",
        dimensions: input.result.size ?? null,
        images_produced: 1,
        cost_usd: costUsd,
        cost_source: hasReportedCost ? "backend_reported" : "official_output_estimate",
        usage_data: input.result.usage ?? {},
      });
  } catch {
    // Analytics must never make a successful image generation fail.
  }
}
