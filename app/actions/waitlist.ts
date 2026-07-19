"use server";

import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { WaitlistState } from "@/lib/waitlist-state";

// Deliberately permissive — the real check is the confirmation email you send later.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

  try {
    const supabase = getSupabaseAdmin();
    const userAgent = (await headers()).get("user-agent")?.slice(0, 500) ?? null;

    const { error } = await supabase.from("waitlist").insert({
      email,
      source: "landing",
      user_agent: userAgent,
    });

    if (error) {
      // 23505 = unique_violation on the lower(email) index
      if (error.code === "23505") {
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
