import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
import { publicEnv } from "./scripts/public-env.mjs";

export default defineConfig(({ mode }) => {
  const { host, serveUrl, keycloakUrl, realm, clientId } = publicEnv(mode);
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
          if (host !== "localhost" && host !== "127.0.0.1") {
            const extra = [`http://${host}:8000/*`, `http://${host}:8080/*`];
            const perms = new Set(manifest.host_permissions ?? []);
            extra.forEach((p) => perms.add(p));
            manifest.host_permissions = [...perms];
          }
          writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        },
      },
    ],
    define: {
      __SERVE_URL__: JSON.stringify(serveUrl),
      __KEYCLOAK_URL__: JSON.stringify(keycloakUrl),
      __KEYCLOAK_REALM__: JSON.stringify(realm),
      __KEYCLOAK_CLIENT_ID__: JSON.stringify(clientId),
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
