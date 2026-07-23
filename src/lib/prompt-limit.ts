export const OPENAI_PROMPT_MAX_CHARACTERS = 32_000;

// Keep a small transport margin so wrappers added by an upstream API cannot
// push an otherwise valid prompt over the documented request limit.
const PROMPT_TARGET_CHARACTERS = 31_500;

function compactPromptText(prompt: string) {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const rawLine of prompt.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.replace(/[ \t]+/g, " ").trim();
    if (!line) {
      if (lines.at(-1) !== "") lines.push("");
      continue;
    }

    const fingerprint = line.toLocaleLowerCase("en");
    if (line.length >= 24 && seen.has(fingerprint)) continue;
    if (line.length >= 24) seen.add(fingerprint);
    lines.push(line);
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Fits prompts to the image API character limit while retaining the role and
 * objective at the beginning and the mandatory final instructions at the end.
 */
export function fitPromptToApiLimit(prompt: string) {
  const normalized = prompt.trim();
  if (normalized.length <= PROMPT_TARGET_CHARACTERS) return normalized;

  const compacted = compactPromptText(normalized);
  if (compacted.length <= PROMPT_TARGET_CHARACTERS) return compacted;

  const marker =
    "\n\n[LONG PROMPT COMPACTED: keep every identity, composition, reference-role, consistency and explicit user constraint stated above and below.]\n\n";
  const available = PROMPT_TARGET_CHARACTERS - marker.length;
  const headLength = Math.floor(available * 0.68);
  const tailLength = available - headLength;

  return `${compacted.slice(0, headLength).trimEnd()}${marker}${compacted
    .slice(-tailLength)
    .trimStart()}`;
}
