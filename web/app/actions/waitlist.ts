"use server";

import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { WaitlistState } from "@/lib/waitlist-state";

// Deliberately permissive — the real check is the confirmation email you send later.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MAX_QUESTION_LEN = 500;

/**
 * Accepts what people actually type — "youtube.com/@show", "@show.com/feed.xml",
 * a full https URL — and returns a canonical one. Returns undefined for blank
 * input and null for something that isn't salvageable as a URL.
 */
function normalizeUrl(raw: string): string | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 500) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    // new URL() happily accepts javascript: and data:; only web URLs may pass.
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // A hostname with no dot is a typo, not a domain.
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
  // Honeypot: real people never see this field, bots fill it in. Fake a success
  // so the bot has nothing to learn from the response.
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

  // Optional: where their catalog lives.
  const feedUrl = normalizeUrl(String(formData.get("feed_url") ?? ""));
  if (feedUrl === null) {
    return { status: "error", message: "That link doesn't look right — paste the full URL." };
  }

  // Optional: a question their audience actually asks.
  const sampleQuestion =
    String(formData.get("sample_question") ?? "")
      .trim()
      .slice(0, MAX_QUESTION_LEN) || undefined;

  try {
    const supabase = getSupabaseAdmin();
    const userAgent = (await headers()).get("user-agent")?.slice(0, 500) ?? null;

    const { error } = await supabase.from("waitlist").insert({
      email,
      feed_url: feedUrl ?? null,
      sample_question: sampleQuestion ?? null,
      source: "landing",
      user_agent: userAgent,
    });

    if (error) {
      // 23505 = unique_violation on the lower(email) index
      if (error.code === "23505") {
        // Already signed up — but they may be resubmitting to add their show or a
        // question they left blank the first time. Keep whatever they just gave us.
        const additions: Record<string, string> = {};
        if (feedUrl) additions.feed_url = feedUrl;
        if (sampleQuestion) additions.sample_question = sampleQuestion;

        if (Object.keys(additions).length > 0) {
          const { error: updateError } = await supabase
            .from("waitlist")
            .update(additions)
            .eq("email", email);

          if (updateError) {
            console.error("[waitlist] enrich failed:", updateError);
          }
        }

        return { status: "success", message: "You're already on the list — sit tight." };
      }
      console.error("[waitlist] insert failed:", error);
      return { status: "error", message: "Something broke on our end. Try again in a moment." };
    }

    return { status: "success", message: "You're on the list. We'll be in touch." };
  } catch (err) {
    console.error("[waitlist] unexpected:", err);
    return { status: "error", message: "Something broke on our end. Try again in a moment." };
  }
}
