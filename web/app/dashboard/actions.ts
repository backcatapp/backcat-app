"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { sql } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.roles?.includes("admin")) throw new Error("forbidden: admin role required");
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
