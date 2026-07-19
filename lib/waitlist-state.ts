/**
 * Shared shape for the waitlist action result.
 *
 * Lives outside the "use server" module on purpose: a server-action file may
 * only export async functions, so the initial-state constant cannot live there.
 */
export type WaitlistState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialWaitlistState: WaitlistState = { status: "idle", message: "" };
