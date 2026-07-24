const viteEnv =
  (
    import.meta as unknown as {
      env?: Record<string, string | boolean | undefined>;
    }
  ).env ?? {};

export function isLocalAiServerMode() {
  const nodeEnabled =
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    process.env.LOCAL_AI_MODE === "true";
  return nodeEnabled || (viteEnv.DEV === true && viteEnv.VITE_LOCAL_AI_MODE === "true");
}

export const isLocalAiClientMode = viteEnv.DEV === true && viteEnv.VITE_LOCAL_AI_MODE === "true";
