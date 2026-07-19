export function isLocalAiServerMode() {
  const metaEnv = import.meta.env as Record<string, string | boolean | undefined>;
  const nodeEnabled =
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    process.env.LOCAL_AI_MODE === "true";
  return nodeEnabled || (metaEnv.DEV === true && metaEnv.VITE_LOCAL_AI_MODE === "true");
}

export const isLocalAiClientMode =
  import.meta.env.DEV && import.meta.env.VITE_LOCAL_AI_MODE === "true";
