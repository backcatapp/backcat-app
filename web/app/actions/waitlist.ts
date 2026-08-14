"use server";

import { headers } from "next/headers";
import { sql } from "@/lib/db";
import type { WaitlistState } from "@/lib/waitlist-state";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_QUESTION_LEN = 500;

function normalizeUrl(raw: string): string | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 500) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  if (formData.get("company")) {
    return { status: "success", message: "You're on the list. We'll be in touch." };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return { status: "error", message: "Enter an email address." };
  }

  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { status: "error", message: "That doesn't look like a valid email." };
  }

  const feedUrl = normalizeUrl(String(formData.get("feed_url") ?? ""));
  if (feedUrl === null) {
    return { status: "error", message: "That link doesn't look right — paste the full URL." };
  }

  const sampleQuestion =
    String(formData.get("sample_question") ?? "")
      .trim()
      .slice(0, MAX_QUESTION_LEN) || null;

  try {
    const userAgent = (await headers()).get("user-agent")?.slice(0, 500) ?? null;

    const inserted = await sql`
      INSERT INTO waitlist (email, feed_url, sample_question, source, user_agent)
      VALUES (${email}, ${feedUrl ?? null}, ${sampleQuestion}, 'landing', ${userAgent})
      ON CONFLICT ((lower(email))) DO NOTHING
      RETURNING id
    `;

    if (inserted.length === 0) {
      if (feedUrl || sampleQuestion) {
        await sql`
          UPDATE waitlist SET
            feed_url = COALESCE(${feedUrl ?? null}, feed_url),
            sample_question = COALESCE(${sampleQuestion}, sample_question)
          WHERE lower(email) = ${email}
        `;
      }
      return { status: "success", message: "You're already on the list — sit tight." };
    }

    await sql`
      INSERT INTO user_events (email, event, props)
      VALUES (${email}, 'waitlist_joined', ${sql.json({ source: "landing" })})
    `;

    return { status: "success", message: "You're on the list. We'll be in touch." };
  } catch (err) {
    console.error("[waitlist] unexpected:", err);
    return { status: "error", message: "Something broke on our end. Try again in a moment." };
  }
}

export async function requestCreditsPublic(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;

  if (!email || !EMAIL_RE.test(email)) {
    return { status: "error", message: "Enter a valid email so we can contact you." };
  }

  try {
    const open = await sql`
      SELECT id FROM credit_requests WHERE lower(email) = ${email} AND status = 'open' LIMIT 1
    `;
    if (open.length > 0) {
      if (note) {
        await sql`
          UPDATE credit_requests SET note = ${note}, updated_at = now()
          WHERE id = ${open[0].id}
        `;
      }
      return {
        status: "success",
        message: "We already have your request — we'll contact you soon.",
      };
    }

    const [row] = await sql`
      INSERT INTO credit_requests (email, note, status)
      VALUES (${email}, ${note}, 'open')
      RETURNING id
    `;
    await sql`
      INSERT INTO user_events (email, event, props)
      VALUES (
        ${email},
        'credit_requested',
        ${sql.json({ request_id: String(row.id), source: "landing" })}
      )
    `;
    return {
      status: "success",
      message: `Thanks — we'll contact you at ${email} to arrange credits.`,
    };
  } catch (err) {
    console.error("[credit-request] unexpected:", err);
    return { status: "error", message: "Something broke on our end. Try again in a moment." };
  }
}
