import { defineConfig, loadEnv } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      preact(),
      {
        name: "backcat-ext-manifest",
        closeBundle() {
          const manifestPath = resolve(__dirname, "dist/manifest.json");
          const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
          manifest.side_panel = { default_path: "src/sidepanel/index.html" };
          manifest.background = { service_worker: "background.js", type: "module" };
          manifest.content_scripts = [
            {
              matches: ["https://www.youtube.com/*", "https://youtube.com/*"],
              js: ["content.js"],
              run_at: "document_idle",
            },
          ];
          writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        },
      },
    ],
    define: {
      __SERVE_URL__: JSON.stringify(env.VITE_SERVE_URL || "http://localhost:8000"),
      __KEYCLOAK_URL__: JSON.stringify(env.VITE_KEYCLOAK_URL || "http://localhost:8080"),
      __KEYCLOAK_REALM__: JSON.stringify(env.VITE_KEYCLOAK_REALM || "backcat"),
      __KEYCLOAK_CLIENT_ID__: JSON.stringify(env.VITE_KEYCLOAK_CLIENT_ID || "backcat-ext"),
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          sidepanel: resolve(__dirname, "src/sidepanel/index.html"),
        },
      },
    },
  };
});
