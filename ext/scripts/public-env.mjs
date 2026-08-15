import { loadEnv } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const extRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(extRoot, "..");

/** Serve / Keycloak URLs from root `.env` PUBLIC_HOST, with VITE_* overrides. */
export function publicEnv(mode = process.env.NODE_ENV === "development" ? "development" : "production") {
  const env = {
    ...loadEnv(mode, repoRoot, ""),
    ...loadEnv(mode, extRoot, ""),
    ...process.env,
  };
  const host = env.PUBLIC_HOST || "localhost";
  return {
    env,
    host,
    serveUrl: env.VITE_SERVE_URL || env.PUBLIC_SERVE || `http://${host}:8000`,
    keycloakUrl: env.VITE_KEYCLOAK_URL || env.PUBLIC_KEYCLOAK || `http://${host}:8080`,
    realm: env.VITE_KEYCLOAK_REALM || "backcat",
    clientId: env.VITE_KEYCLOAK_CLIENT_ID || "backcat-ext",
  };
}
