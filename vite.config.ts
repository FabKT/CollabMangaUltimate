import { fileURLToPath, URL } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import netlify from "@netlify/vite-plugin-tanstack-start";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig(() => {
  const isNetlify = process.env.NETLIFY === "true";

  return {
    css: {
      postcss: {
        plugins: [],
      },
    },
    plugins: [
      tanstackStart({
        server: { entry: "server" },
      }),
      viteReact(),
      isNetlify ? netlify() : nitro({ preset: "node_server" }),
      tailwindcss(),
    ],
    resolve: {
      tsconfigPaths: true,
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      dedupe: ["react", "react-dom", "@tanstack/react-router"],
    },
  };
});
