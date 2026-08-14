/**
 * Bundle background + content as single files (no shared chunks).
 * Side panel is built by Vite (ESM OK inside extension pages).
 */
import * as esbuild from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const define = {
  __SERVE_URL__: JSON.stringify(process.env.VITE_SERVE_URL || "http://localhost:8000"),
  __KEYCLOAK_URL__: JSON.stringify(process.env.VITE_KEYCLOAK_URL || "http://localhost:8080"),
  __KEYCLOAK_REALM__: JSON.stringify(process.env.VITE_KEYCLOAK_REALM || "backcat"),
  __KEYCLOAK_CLIENT_ID__: JSON.stringify(process.env.VITE_KEYCLOAK_CLIENT_ID || "backcat-ext"),
};

await esbuild.build({
  entryPoints: [resolve(root, "src/background.ts")],
  outfile: resolve(root, "dist/background.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome110"],
  define,
});

await esbuild.build({
  entryPoints: [resolve(root, "src/content/youtube.ts")],
  outfile: resolve(root, "dist/content.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome110"],
  define,
});

console.log("wrote dist/background.js + dist/content.js");
