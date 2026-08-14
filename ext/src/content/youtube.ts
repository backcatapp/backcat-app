/**
 * YouTube watch UX — ALWAYS inject a Backcat pill on watch pages.
 * API calls go through the background service worker (localhost from
 * youtube.com is often blocked by Private Network Access).
 */

import { appendChat, clearChat, loadChat, type ChatTurn } from "../lib/chat";

const BTN_ID = "backcat-ask-btn";
const FALLBACK_ID = "backcat-ask-fallback";
const PANEL_HOST_ID = "backcat-ask-panel";

type Lookup = {
  catalog_id: string;
  episode_id: string;
  catalog_name: string;
  episode_title: string;
  indexed: boolean;
  indexing?: boolean;
  saved?: boolean;
  owned?: boolean;
  linked?: boolean;
};

type Source = {
  i: number;
  episode: string;
  start_s: number;
  end_s: number;
  source_url?: string | null;
};

function videoIdFromLocation(): string | null {
  try {
    const u = new URL(location.href);
    if (u.pathname.startsWith("/watch")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(shorts|live|embed)\/([\w-]{6,})/);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}

function api(
  path: string,
  opts?: { method?: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "api", path, method: opts?.method, body: opts?.body },
      (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, status: 0, data: null, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(resp ?? { ok: false, status: 0, data: null, error: "no response" });
      }
    );
  });
}

function askViaBackground(
  catalogId: string,
  question: string,
  handlers: {
    onSources: (s: Source[]) => void;
    onDelta: (t: string) => void;
    onAbsence: (m: string) => void;
    onError: (m: string) => void;
    onDone: () => void;
  }
): Promise<void> {
  const requestId = `ask_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    const listener = (msg: {
      type?: string;
      requestId?: string;
      event?: string;
      data?: unknown;
    }) => {
      if (msg?.type !== "ask-event" || msg.requestId !== requestId) return;
      const d = msg.data as Record<string, unknown>;
      if (msg.event === "sources") handlers.onSources(msg.data as Source[]);
      else if (msg.event === "delta") handlers.onDelta(String((d as { text?: string }).text || ""));
      else if (msg.event === "absence") {
        handlers.onAbsence(String((d as { message?: string }).message || ""));
        chrome.runtime.onMessage.removeListener(listener);
        resolve();
      } else if (msg.event === "error") {
        handlers.onError(String((d as { message?: string }).message || "error"));
        chrome.runtime.onMessage.removeListener(listener);
        resolve();
      } else if (msg.event === "done") {
        handlers.onDone();
        chrome.runtime.onMessage.removeListener(listener);
        resolve();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    chrome.runtime.sendMessage(
      { type: "ask-stream", catalogId, question, requestId },
      () => {
        if (chrome.runtime.lastError) {
          chrome.runtime.onMessage.removeListener(listener);
          handlers.onError(chrome.runtime.lastError.message || "ask failed");
          resolve();
        }
      }
    );
  });
}

function seekTo(seconds: number) {
  const video = document.querySelector("video");
  if (video) {
    video.currentTime = seconds;
    void video.play();
  }
}

function ts(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isDarkTheme(): boolean {
  return (
    document.documentElement.getAttribute("dark") != null ||
    document.querySelector("html[dark]") != null ||
    getComputedStyle(document.documentElement).colorScheme === "dark"
  );
}

function findActionsRow(): HTMLElement | null {
  const selectors = [
    "#actions #flexible-item-buttons",
    "#actions-inner #flexible-item-buttons",
    "ytd-watch-metadata #flexible-item-buttons",
    "#top-row #actions #flexible-item-buttons",
    "#actions #top-level-buttons-computed",
    "ytd-watch-metadata #top-level-buttons-computed",
    "#actions #menu-container",
    "#actions",
    "ytd-watch-metadata #actions",
    "#below #actions",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLElement && el.offsetParent !== null) return el;
  }
  return null;
}

function removeButtons() {
  document.getElementById(BTN_ID)?.remove();
  document.getElementById(FALLBACK_ID)?.remove();
}

function stylePill(btn: HTMLButtonElement) {
  const dark = isDarkTheme();
  Object.assign(btn.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    height: "36px",
    padding: "0 16px",
    marginInlineStart: "8px",
    border: "none",
    borderRadius: "18px",
    background: dark ? "#272727" : "#f2f2f2",
    color: dark ? "#f1f1f1" : "#0f0f0f",
    font: "500 14px/36px Roboto, Arial, sans-serif",
    cursor: "pointer",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
    flexShrink: "0",
    position: "relative",
    zIndex: "10",
  });
}

function makeButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.type = "button";
  btn.title = "Ask Backcat";
  btn.setAttribute("aria-label", "Ask Backcat");
  stylePill(btn);
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3c-1.8 3.2-3.2 4.6-6.4 6.4C8.8 11.2 10.2 12.6 12 15.8c1.8-3.2 3.2-4.6 6.4-6.4C15.2 7.6 13.8 6.2 12 3z" fill="#e06a1f"/>
      <path d="M18.5 14.5c-.9 1.5-1.5 2.1-3 3 1.5.9 2.1 1.5 3 3 .9-1.5 1.5-2.1 3-3-1.5-.9-2.1-1.5-3-3z" fill="#e06a1f" opacity=".85"/>
    </svg>
    <span>Backcat</span>
  `;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    void openPanel();
  });
  return btn;
}

/** Always try to put Backcat in the actions row; otherwise floating fallback. */
function injectButton() {
  if (!videoIdFromLocation()) {
    removeButtons();
    return;
  }
  if (document.getElementById(BTN_ID)) return;

  const row = findActionsRow();
  if (row) {
    document.getElementById(FALLBACK_ID)?.remove();
    const btn = makeButton();
    // After Gemini Ask / Share if we can find them
    const kids = Array.from(row.children);
    const after = kids.find((el) => /ask|share/i.test(el.textContent || ""));
    if (after?.nextSibling) row.insertBefore(btn, after.nextSibling);
    else if (after) row.appendChild(btn);
    else row.appendChild(btn);
    return;
  }

  if (document.getElementById(FALLBACK_ID)) return;
  const fb = document.createElement("button");
  fb.id = FALLBACK_ID;
  fb.type = "button";
  fb.innerHTML = `<span style="font-weight:700">Back<span style="opacity:.9">cat</span></span>`;
  Object.assign(fb.style, {
    position: "fixed",
    right: "20px",
    bottom: "100px",
    zIndex: "2147483645",
    height: "44px",
    padding: "0 20px",
    border: "none",
    borderRadius: "22px",
    background: "#e06a1f",
    color: "#111",
    font: "600 14px system-ui,sans-serif",
    cursor: "pointer",
    boxShadow: "0 6px 20px rgba(0,0,0,.4)",
  });
  fb.addEventListener("click", () => void openPanel());
  document.documentElement.appendChild(fb);
}

function hidePanel() {
  document.getElementById(PANEL_HOST_ID)?.remove();
}

/** Stop Space / shortcuts from reaching the YouTube player while typing. */
function trapPanelKeys(host: HTMLElement, root: ShadowRoot) {
  const trap = (e: Event) => {
    e.stopPropagation();
    if ("stopImmediatePropagation" in e) {
      (e as Event & { stopImmediatePropagation: () => void }).stopImmediatePropagation();
    }
  };
  for (const type of ["keydown", "keyup", "keypress"] as const) {
    host.addEventListener(type, trap, true);
    root.addEventListener(type, trap, true);
  }
  // Capture on document while panel is open — YT listens at document level.
  const docTrap = (e: KeyboardEvent) => {
    const t = e.target as Node | null;
    if (!t) return;
    if (host.contains(t) || root.contains(t)) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Space/arrows still type in our inputs; only block bubbling to YT.
    }
  };
  for (const type of ["keydown", "keyup", "keypress"] as const) {
    document.addEventListener(type, docTrap, true);
  }
  const cleanup = () => {
    for (const type of ["keydown", "keyup", "keypress"] as const) {
      document.removeEventListener(type, docTrap, true);
    }
  };
  const obs = new MutationObserver(() => {
    if (!document.getElementById(PANEL_HOST_ID)) {
      cleanup();
      obs.disconnect();
    }
  });
  obs.observe(document.documentElement, { childList: true });
}

function renderCitedText(
  el: HTMLElement,
  text: string,
  sources: Source[],
  onSeek: (s: number) => void
) {
  el.replaceChildren();
  for (const p of text.split(/(\[\d+\])/g)) {
    const m = p.match(/^\[(\d+)\]$/);
    if (!m) {
      el.appendChild(document.createTextNode(p));
      continue;
    }
    const src = sources.find((x) => x.i === Number(m[1]));
    const cite = document.createElement("button");
    cite.type = "button";
    cite.className = "cite";
    cite.textContent = src ? `${src.episode} · ${ts(src.start_s)}` : p;
    if (src) cite.addEventListener("click", () => onSeek(src.start_s));
    el.appendChild(cite);
  }
}

function renderThread(
  thread: HTMLElement,
  turns: ChatTurn[],
  live?: { q: string; a: string; sources: Source[] } | null
) {
  thread.replaceChildren();
  const paint = (q: string, a: string, sources: Source[], pending?: boolean) => {
    const wrap = document.createElement("div");
    wrap.className = "turn";
    const qEl = document.createElement("div");
    qEl.className = "bubble q";
    qEl.dir = "auto";
    qEl.textContent = q;
    wrap.appendChild(qEl);
    if (a || pending) {
      const aEl = document.createElement("div");
      aEl.className = "bubble a";
      aEl.dir = "auto";
      if (pending && !a) aEl.textContent = "…";
      else renderCitedText(aEl, a, sources, seekTo);
      wrap.appendChild(aEl);
    }
    thread.appendChild(wrap);
  };
  for (const t of turns) paint(t.q, t.a, t.sources);
  if (live) paint(live.q, live.a, live.sources, true);
  thread.scrollTop = thread.scrollHeight;
}

async function openPanel() {
  hidePanel();
  const vid = videoIdFromLocation();
  const host = document.createElement("div");
  host.id = PANEL_HOST_ID;
  host.style.cssText =
    "position:fixed;top:56px;right:0;bottom:0;width:min(400px,100vw);z-index:2147483646;pointer-events:none;";
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  trapPanelKeys(host, root);
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .panel {
        pointer-events: auto; height: 100%; display: flex; flex-direction: column;
        background: #16161d; color: #e8e8ec; border-left: 1px solid #2a2a36;
        font-family: "Segoe UI", system-ui, sans-serif; font-size: 13px;
        box-shadow: -8px 0 32px rgba(0,0,0,.35);
      }
      .head { display: flex; gap: 10px; padding: 14px; border-bottom: 1px solid #2a2a36; }
      .brand { font-weight: 700; font-size: 15px; }
      .brand span { color: #e06a1f; }
      .sub { color: #8b8b96; font-size: 11px; margin-top: 4px; }
      .title { color: #c9c9cf; font-size: 12px; margin-top: 6px; line-height: 1.35; }
      .close {
        margin-left: auto; background: transparent; border: 1px solid #2a2a36;
        color: #c9c9cf; width: 28px; height: 28px; border-radius: 8px; cursor: pointer;
      }
      .body { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
      .greet {
        background: #1e1e28; border: 1px solid #2a2a36; border-radius: 12px;
        padding: 12px; line-height: 1.45;
      }
      .greet strong { color: #e06a1f; }
      .badge {
        display: inline-block; font-size: 10px; font-family: ui-monospace, monospace;
        padding: 2px 8px; border-radius: 999px; margin-top: 8px;
      }
      .badge.ok { background: #16352e; color: #1f9a80; }
      .badge.warn { background: #3a2a18; color: #e06a1f; }
      .badge.info { background: #1a2838; color: #6aa8e0; }
      .thread { display: flex; flex-direction: column; gap: 10px; flex: 1; }
      .turn { display: flex; flex-direction: column; gap: 6px; }
      .bubble {
        border-radius: 12px; padding: 10px 12px; line-height: 1.45; white-space: pre-wrap;
      }
      .bubble.q { background: #2a2218; border: 1px solid #4a3520; align-self: flex-end; max-width: 92%; }
      .bubble.a { background: #1e1e28; border: 1px solid #2a2a36; align-self: stretch; }
      .cite {
        display: inline-flex; background: #2a2218; color: #e06a1f; border: 1px solid #4a3520;
        border-radius: 999px; padding: 2px 8px; font-size: 11px; font-family: ui-monospace, monospace;
        cursor: pointer; margin: 0 2px;
      }
      .meta { color: #8b8b96; font-size: 11px; font-family: ui-monospace, monospace; }
      .foot { border-top: 1px solid #2a2a36; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
      textarea {
        width: 100%; min-height: 64px; resize: vertical; background: #1e1e28;
        border: 1px solid #2a2a36; color: #e8e8ec; border-radius: 10px; padding: 10px 12px; font: inherit;
      }
      .row { display: flex; gap: 8px; flex-wrap: wrap; }
      button.primary {
        flex: 1; background: #e06a1f; color: #111; border: none; border-radius: 8px;
        padding: 10px 12px; font-weight: 600; cursor: pointer; font: inherit;
      }
      button.primary:disabled { opacity: .5; cursor: not-allowed; }
      button.ghost {
        background: transparent; color: #e8e8ec; border: 1px solid #2a2a36;
        border-radius: 8px; padding: 10px 12px; cursor: pointer; font: inherit;
      }
      button.linkish {
        background: none; border: none; color: #8b8b96; font: inherit; font-size: 11px;
        cursor: pointer; padding: 0; text-decoration: underline;
      }
      .err { color: #e05a5a; font-size: 12px; }
    </style>
    <div class="panel">
      <div class="head">
        <div>
          <div class="brand">Back<span>cat</span></div>
          <div class="sub">Ask about this video</div>
          <div class="title" dir="auto">Loading…</div>
        </div>
        <button class="close" type="button">×</button>
      </div>
      <div class="body">
        <div class="greet">Looking up this video in your catalogs…</div>
        <div class="thread" hidden></div>
        <div class="meta status"></div>
        <div class="err" hidden></div>
      </div>
      <div class="foot"></div>
    </div>
  `;
  root.querySelector(".close")!.addEventListener("click", hidePanel);

  const openSide = () => {
    hidePanel();
    chrome.runtime.sendMessage({ type: "open-side-panel" });
  };

  if (!vid) {
    (root.querySelector(".greet") as HTMLElement).textContent = "Open a YouTube watch page first.";
    return;
  }

  const res = await api(`/api/videos/${encodeURIComponent(vid)}`);
  const greet = root.querySelector(".greet") as HTMLElement;
  const titleEl = root.querySelector(".title") as HTMLElement;
  const foot = root.querySelector(".foot") as HTMLElement;
  const errEl = root.querySelector(".err") as HTMLElement;
  const thread = root.querySelector(".thread") as HTMLElement;
  const statusEl = root.querySelector(".status") as HTMLElement;

  if (!res.ok || !res.data) {
    titleEl.textContent = "Not in Backcat yet";
    greet.innerHTML = `This video isn’t in a saved catalog.
      <div class="badge warn">not listed</div>`;
    foot.innerHTML = `<button class="primary" type="button" data-open-panel>Open side panel to add channel</button>`;
    foot.querySelector("[data-open-panel]")!.addEventListener("click", openSide);
    if (res.error) {
      errEl.hidden = false;
      errEl.textContent = res.error;
    }
    return;
  }

  const data = res.data as Lookup;
  titleEl.textContent = data.episode_title;
  titleEl.dir = "auto";

  const openGraph = () => {
    chrome.storage.local.set(
      {
        backcat_open_graph: {
          catalogId: data.catalog_id,
          episodeId: data.episode_id,
        },
      },
      () => openSide()
    );
  };

  if (data.indexed) {
    const chatScope = `ep_${data.episode_id}`;
    let turns = await loadChat(chatScope);
    greet.innerHTML = `Answers from <strong></strong>, cited to the second.
      <div class="badge ok">indexed</div>`;
    (greet.querySelector("strong") as HTMLElement).textContent = data.catalog_name;

    thread.hidden = false;
    const historyBar = document.createElement("div");
    historyBar.className = "row";
    historyBar.style.justifyContent = "space-between";
    historyBar.innerHTML = `<span class="meta">Chat on this video</span>
      <button class="linkish" type="button" data-clear>Clear history</button>`;
    thread.before(historyBar);
    historyBar.querySelector("[data-clear]")!.addEventListener("click", async () => {
      await clearChat(chatScope);
      turns = [];
      renderThread(thread, turns);
    });
    renderThread(thread, turns);

    foot.innerHTML = `
      <textarea rows="3" placeholder="What did they say about…?"></textarea>
      <div class="row">
        <button class="primary" type="button">Ask</button>
        <button class="ghost" type="button" data-open-panel>Side panel</button>
        <button class="ghost" type="button" data-graph>Graph</button>
      </div>
    `;
    foot.querySelector("[data-open-panel]")!.addEventListener("click", openSide);
    foot.querySelector("[data-graph]")!.addEventListener("click", openGraph);

    const ta = foot.querySelector("textarea") as HTMLTextAreaElement;
    const askBtn = foot.querySelector(".primary") as HTMLButtonElement;
    let sources: Source[] = [];
    let busy = false;

    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        askBtn.click();
      }
    });

    askBtn.addEventListener("click", async () => {
      const q = ta.value.trim();
      if (q.length < 3 || busy) return;
      busy = true;
      askBtn.disabled = true;
      sources = [];
      let answer = "";
      ta.value = "";
      errEl.hidden = true;
      statusEl.textContent = "Thinking…";
      renderThread(thread, turns, { q, a: "", sources });

      await askViaBackground(data.catalog_id, q, {
        onSources: (s) => {
          sources = s;
          statusEl.textContent = "Answering…";
        },
        onDelta: (t) => {
          answer += t;
          renderThread(thread, turns, { q, a: answer, sources });
        },
        onAbsence: (m) => {
          answer = m;
          renderThread(thread, turns, { q, a: answer, sources });
          statusEl.textContent = "";
        },
        onError: (m) => {
          errEl.hidden = false;
          errEl.textContent = m;
          statusEl.textContent = "";
          renderThread(thread, turns);
        },
        onDone: () => {
          statusEl.textContent = "";
        },
      });

      if (answer) {
        turns = await appendChat(chatScope, {
          id: `t_${Date.now()}`,
          q,
          a: answer,
          sources,
          at: Date.now(),
        });
        renderThread(thread, turns);
      }
      busy = false;
      askBtn.disabled = false;
      ta.focus();
    });
  } else {
    const badge = data.indexing ? "indexing…" : "listed only";
    const badgeCls = data.indexing ? "info" : "warn";
    greet.innerHTML = `In <strong></strong> but not ready to Ask yet.
      <div class="badge ${badgeCls}">${badge}</div>`;
    (greet.querySelector("strong") as HTMLElement).textContent = data.catalog_name;
    foot.innerHTML = `
      <button class="primary" type="button" data-index ${data.indexing ? "disabled" : ""}>
        ${data.indexing ? "Indexing…" : "Index this video"}
      </button>
      <div class="row">
        <button class="ghost" type="button" data-open-panel>Side panel</button>
        <button class="ghost" type="button" data-graph>Graph</button>
      </div>
      <div class="meta">Index queues Whisper (~$0.04/audio-hour). Worker must be running.</div>
    `;
    foot.querySelector("[data-open-panel]")!.addEventListener("click", openSide);
    foot.querySelector("[data-graph]")!.addEventListener("click", openGraph);
    const indexBtn = foot.querySelector("[data-index]") as HTMLButtonElement;
    indexBtn?.addEventListener("click", async () => {
      indexBtn.disabled = true;
      indexBtn.textContent = "Queuing…";
      const r = await api(`/api/me/episodes/${data.episode_id}/index`, { method: "POST" });
      if (r.ok) {
        indexBtn.textContent = "Indexing…";
        greet.innerHTML = `Indexing started for <strong>${data.catalog_name}</strong>.
          <div class="badge info">indexing…</div>`;
      } else {
        indexBtn.disabled = false;
        indexBtn.textContent = "Index this video";
        errEl.hidden = false;
        errEl.textContent =
          (r.data as { detail?: string })?.detail || r.error || `Failed (${r.status}) — save the channel first.`;
      }
    });
  }
}

let observer: MutationObserver | null = null;

function ensureObserver() {
  if (observer) return;
  observer = new MutationObserver(() => {
    if (videoIdFromLocation() && !document.getElementById(BTN_ID)) injectButton();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function onNavigate() {
  if (!videoIdFromLocation()) {
    removeButtons();
    hidePanel();
    return;
  }
  injectButton();
  ensureObserver();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "seek" && typeof msg.start_s === "number") seekTo(msg.start_s);
  if (msg?.type === "close-backcat-panel") hidePanel();
});

document.addEventListener("yt-navigate-finish", () => onNavigate());
onNavigate();

let lastHref = location.href;
setInterval(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    onNavigate();
  } else if (videoIdFromLocation() && !document.getElementById(BTN_ID) && !document.getElementById(FALLBACK_ID)) {
    injectButton();
  }
}, 800);
