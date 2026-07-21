export const SERVE_URL =
  process.env.NEXT_PUBLIC_SERVE_URL ?? "http://localhost:8000";

export type Source = {
  i: number;
  episode: string;
  start_s: number;
  end_s: number;
  source_url?: string | null;
  text?: string;
};

/** Extract a YouTube video id from watch/short/embed/youtu.be URLs. */
export function youtubeId(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com") || u.hostname.endsWith("youtube-nocookie.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {
    return null;
  }
  return null;
}

export type AskEvents = {
  onSources: (sources: Source[]) => void;
  onDelta: (text: string) => void;
  onAbsence: (message: string) => void;
  onError: (message: string) => void;
  onDone: () => void;
};

export function ts(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** POST the question and dispatch parsed SSE events. Resolves when the stream ends. */
export async function askStream(
  catalogId: string,
  question: string,
  events: AskEvents,
  signal?: AbortSignal
): Promise<void> {
  const resp = await fetch(`${SERVE_URL}/api/catalogs/${catalogId}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  });
  if (!resp.ok || !resp.body) {
    events.onError(`request failed (${resp.status})`);
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let ended = false;

  const dispatch = (block: string) => {
    let event = "";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data += line.slice(6);
    }
    if (!event) return;
    const payload = data ? JSON.parse(data) : {};
    if (event === "sources") events.onSources(payload as Source[]);
    else if (event === "delta") events.onDelta((payload as { text: string }).text);
    else if (event === "absence") {
      events.onAbsence((payload as { message: string }).message);
      ended = true;
    } else if (event === "error") {
      events.onError((payload as { message: string }).message);
      ended = true;
    } else if (event === "done") {
      events.onDone();
      ended = true;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      dispatch(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (!ended) events.onError("connection interrupted");
}
