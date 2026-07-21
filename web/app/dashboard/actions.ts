"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.roles?.includes("admin")) throw new Error("forbidden: admin role required");
}

// Mirrors backcat_pipeline.ids.det_id — keep in sync.
function detId(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

const SERVE_INTERNAL = process.env.SERVE_INTERNAL_URL ?? "http://localhost:8000";
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN ?? "dev-internal-token";

export async function addYoutubeChannel(formData: FormData) {
  await requireAdmin();
  const url = String(formData.get("channel_url") ?? "").trim();
  if (!url) return;
  const resp = await fetch(`${SERVE_INTERNAL}/api/internal/channels`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-token": INTERNAL_TOKEN },
    body: JSON.stringify({ url }),
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`could not add channel: ${detail.slice(0, 200)}`);
  }
  revalidatePath("/dashboard");
}

const STAGES = ["download", "transcribe", "chunk", "embed", "graph"] as const;

export async function queueEpisode(episodeId: string) {
  await requireAdmin();
  const [ep] = await sql`SELECT catalog_id FROM episodes WHERE id = ${episodeId}`;
  if (!ep) return;
  for (const stage of STAGES) {
    await sql`
      INSERT INTO jobs (id, catalog_id, episode_id, stage)
      VALUES (${detId(episodeId, stage)}, ${ep.catalog_id}, ${episodeId}, ${stage})
      ON CONFLICT (episode_id, stage) DO NOTHING
    `;
  }
  revalidatePath(`/dashboard/catalogs/${ep.catalog_id}`);
}

async function setConfig(key: string, value: unknown) {
  await sql`
    INSERT INTO app_config (key, value) VALUES (${key}, ${sql.json(value as never)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

export async function saveGlobalConfig(formData: FormData) {
  await requireAdmin();
  await setConfig("kill_switch", formData.get("kill_switch") === "on");
  await setConfig("daily_spend_limit_usd", Number(formData.get("daily_spend_limit_usd") ?? 5));
  await setConfig("model.asr", String(formData.get("model_asr") ?? "whisper-large-v3-turbo"));
  revalidatePath("/dashboard/settings");
}

export async function saveCatalogConfig(catalogId: string, formData: FormData) {
  await requireAdmin();
  await sql`
    UPDATE catalogs SET embedding_provider = ${String(formData.get("embedding_provider") ?? "openai")}
    WHERE id = ${catalogId}
  `;
  revalidatePath("/dashboard/settings");
}

export async function togglePause(catalogId: string) {
  await requireAdmin();
  await sql`UPDATE catalogs SET paused = NOT paused WHERE id = ${catalogId}`;
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}

export async function retryFailed(catalogId: string) {
  await requireAdmin();
  await sql`
    UPDATE jobs SET status = 'queued', attempt_count = 0, error = NULL
    WHERE catalog_id = ${catalogId} AND status = 'failed'
  `;
  revalidatePath("/dashboard");
}

export async function reindexTranscribe(catalogId: string) {
  await requireAdmin();
  // Feature 1.8: force re-transcription. Safe by construction — deterministic
  // IDs + upserts mean a re-run replaces rows instead of duplicating them.
  await sql`
    UPDATE jobs SET status = 'queued', attempt_count = 0, error = NULL
    WHERE catalog_id = ${catalogId} AND stage = 'transcribe'
  `;
  revalidatePath("/dashboard");
}
