/**
 * YouTube watch-page panel: if the video belongs to an indexed catalog,
 * show a compact Backcat chip. Citation seeks use the page's own <video>.
 */

const SERVE = __SERVE_URL__;

type Lookup = {
  catalog_id: string;
  episode_id: string;
  catalog_name: string;
  episode_title: string;
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

async function lookup(vid: string): Promise<Lookup | null> {
  try {
    const resp = await fetch(`${SERVE}/api/videos/${encodeURIComponent(vid)}`);
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

function seekTo(seconds: number) {
  const video = document.querySelector("video");
  if (video) {
    video.currentTime = seconds;
    void video.play();
  }
}

function ensurePanel(data: Lookup) {
  const hostId = "backcat-yt-panel";
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement("div");
    host.id = hostId;
    host.style.cssText =
      "position:fixed;right:16px;bottom:88px;z-index:2147483646;font-family:system-ui,sans-serif;";
    document.documentElement.appendChild(host);
  }

  const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      .card {
        background: #16161d;
        color: #e8e8ec;
        border: 1px solid #2a2a36;
        border-radius: 12px;
        padding: 12px 14px;
        width: 260px;
        box-shadow: 0 8px 32px rgba(0,0,0,.45);
      }
      .brand { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
      .brand span { color: #e06a1f; }
      .name { font-size: 12px; color: #c9c9cf; margin-bottom: 10px; line-height: 1.35; }
      button {
        width: 100%;
        background: #e06a1f;
        color: #111;
        border: none;
        border-radius: 8px;
        padding: 8px 10px;
        font-weight: 600;
        cursor: pointer;
        font-size: 12px;
      }
      .meta { font-size: 10px; color: #8b8b96; margin-top: 8px; font-family: ui-monospace, monospace; }
    </style>
    <div class="card">
      <div class="brand">Back<span>cat</span></div>
      <div class="name"></div>
      <button type="button">Open side panel to ask</button>
      <div class="meta">Indexed in this catalog</div>
    </div>
  `;
  const nameEl = root.querySelector(".name") as HTMLElement;
  nameEl.textContent = data.catalog_name;
  nameEl.dir = "auto";
  root.querySelector("button")!.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "open-side-panel" });
  });
}

function hidePanel() {
  document.getElementById("backcat-yt-panel")?.remove();
}

async function onNavigate() {
  const vid = videoIdFromLocation();
  if (!vid) {
    hidePanel();
    return;
  }
  const data = await lookup(vid);
  if (!data) {
    hidePanel();
    return;
  }
  ensurePanel(data);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "seek" && typeof msg.start_s === "number") {
    seekTo(msg.start_s);
  }
});

document.addEventListener("yt-navigate-finish", () => void onNavigate());
void onNavigate();
// SPA fallback: poll the URL lightly
let last = location.href;
setInterval(() => {
  if (location.href !== last) {
    last = location.href;
    void onNavigate();
  }
}, 1500);
