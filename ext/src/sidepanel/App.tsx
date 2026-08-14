import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import {
  addChannel,
  clearByok,
  fetchCatalogs,
  fetchProfile,
  lookupVideo,
  saveByok,
  saveCatalog,
  unsaveCatalog,
  updateDisplayName,
  type CatalogRow,
  type Profile,
} from "../lib/api";
import { askStream, ts, type Source, youtubeId } from "../lib/ask";
import { getAccessToken, login, logout } from "../lib/auth";

type Tab = "channels" | "ask" | "profile";

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<Tab>("channels");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCatalog, setSelectedCatalog] = useState<string>("");
  const [watchCatalog, setWatchCatalog] = useState<{
    catalog_id: string;
    catalog_name: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    const t = await getAccessToken();
    setToken(t);
    if (!t) {
      setProfile(null);
      setCatalogs([]);
      return;
    }
    const [p, c] = await Promise.all([fetchProfile(), fetchCatalogs()]);
    setProfile(p);
    setCatalogs(c);
  }, []);

  useEffect(() => {
    refresh()
      .catch((e) => setError(String((e as Error).message || e)))
      .finally(() => setBooting(false));
  }, [refresh]);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const url = tabs[0]?.url;
      if (!url || !url.includes("youtube.com")) return;
      const vid = youtubeId(url);
      if (!vid) return;
      try {
        const hit = await lookupVideo(vid);
        if (hit) setWatchCatalog({ catalog_id: hit.catalog_id, catalog_name: hit.catalog_name });
      } catch {
        /* ignore */
      }
    });
  }, [token]);

  const onLogin = async () => {
    setError(null);
    try {
      await login();
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onLogout = async () => {
    await logout();
    setToken(null);
    setProfile(null);
    setCatalogs([]);
  };

  if (booting) return <div class="empty">Loading…</div>;

  if (!token) {
    return (
      <div class="sign-in">
        <div style={{ fontSize: 22, fontWeight: 700 }}>
          Back<span style={{ color: "var(--accent)" }}>cat</span>
        </div>
        <p>Ask any saved creator’s catalog — answers cited to the exact second.</p>
        <button class="btn" onClick={onLogin}>
          Sign in
        </button>
        {error && <div class="err">{error}</div>}
      </div>
    );
  }

  return (
    <>
      <header class="app-bar">
        <div class="logo">
          Back<span>cat</span>
        </div>
        <div style={{ flex: 1 }} />
        <span class="meta">{profile?.email}</span>
      </header>
      <nav class="tabs">
        <button class={tab === "channels" ? "active" : ""} onClick={() => setTab("channels")}>
          Channels
        </button>
        <button class={tab === "ask" ? "active" : ""} onClick={() => setTab("ask")}>
          Ask
        </button>
        <button class={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
          Profile
        </button>
      </nav>
      <main>
        {error && <div class="err">{error}</div>}
        {tab === "channels" && (
          <ChannelsTab
            catalogs={catalogs}
            watchCatalog={watchCatalog}
            onChange={async () => {
              setError(null);
              try {
                await refresh();
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
            onError={setError}
            onAsk={(id) => {
              setSelectedCatalog(id);
              setTab("ask");
            }}
          />
        )}
        {tab === "ask" && (
          <AskTab
            catalogs={catalogs}
            selectedId={selectedCatalog || watchCatalog?.catalog_id || catalogs[0]?.id || ""}
            onSelect={setSelectedCatalog}
            token={token}
            onQuota={() => setTab("profile")}
          />
        )}
        {tab === "profile" && profile && (
          <ProfileTab
            profile={profile}
            onRefresh={refresh}
            onLogout={onLogout}
            onError={setError}
          />
        )}
      </main>
    </>
  );
}

function ChannelsTab(props: {
  catalogs: CatalogRow[];
  watchCatalog: { catalog_id: string; catalog_name: string } | null;
  onChange: () => Promise<void>;
  onError: (s: string | null) => void;
  onAsk: (id: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    props.onError(null);
    try {
      await addChannel(url.trim());
      setUrl("");
      await props.onChange();
    } catch (e: unknown) {
      props.onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveWatch = async () => {
    if (!props.watchCatalog) return;
    setBusy(true);
    try {
      await saveCatalog(props.watchCatalog.catalog_id);
      await props.onChange();
    } catch (e: unknown) {
      props.onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {props.watchCatalog && (
        <div class="card">
          <h3 dir="auto">{props.watchCatalog.catalog_name}</h3>
          <div class="meta">Detected on this YouTube tab</div>
          <div class="row" style={{ marginTop: 10 }}>
            <button class="btn ghost" disabled={busy} onClick={saveWatch}>
              Save channel
            </button>
            <button class="btn" onClick={() => props.onAsk(props.watchCatalog!.catalog_id)}>
              Ask
            </button>
          </div>
        </div>
      )}

      <div class="field">
        <label>Add YouTube channel URL or @handle</label>
        <div class="row">
          <input
            placeholder="https://youtube.com/@…"
            value={url}
            onInput={(e) => setUrl((e.target as HTMLInputElement).value)}
          />
          <button class="btn" style={{ flex: "0 0 auto" }} disabled={busy || !url.trim()} onClick={add}>
            Add
          </button>
        </div>
        <div class="meta" style={{ marginTop: 6 }}>
          Lists recent videos only — transcription stays admin-gated for now.
        </div>
      </div>

      {props.catalogs.length === 0 ? (
        <div class="empty">No saved channels yet. Add a YouTube URL above.</div>
      ) : (
        props.catalogs.map((c) => (
          <div class="card" key={c.id}>
            <h3 dir="auto">{c.name}</h3>
            <div class="meta">
              {c.episodes} episodes · {c.indexed ? `${c.chunks} chunks` : "listed, not indexed yet"} ·{" "}
              {c.kinds.join(", ")}
            </div>
            <div class="row" style={{ marginTop: 10 }}>
              <button class="btn" onClick={() => props.onAsk(c.id)} disabled={!c.indexed}>
                Ask
              </button>
              <button
                class="btn ghost"
                onClick={async () => {
                  try {
                    await unsaveCatalog(c.id);
                    await props.onChange();
                  } catch (e: unknown) {
                    props.onError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Unsave
              </button>
            </div>
          </div>
        ))
      )}
    </>
  );
}

function AskTab(props: {
  catalogs: CatalogRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  token: string;
  onQuota: () => void;
}) {
  const [catalogId, setCatalogId] = useState(props.selectedId);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (props.selectedId) setCatalogId(props.selectedId);
  }, [props.selectedId]);

  const indexed = useMemo(() => props.catalogs.filter((c) => c.indexed), [props.catalogs]);

  const ask = async () => {
    if (!catalogId || !question.trim()) return;
    setBusy(true);
    setAnswer("");
    setSources([]);
    setStatus("Thinking…");
    try {
      await askStream(
        catalogId,
        question.trim(),
        {
          onSources: (s) => {
            setSources(s);
            setStatus("Answering…");
          },
          onDelta: (t) => setAnswer((a) => a + t),
          onAbsence: (m) => {
            setAnswer(m);
            setStatus(null);
          },
          onError: (m, code) => {
            setAnswer("");
            setStatus(m);
            if (code === 402) props.onQuota();
          },
          onDone: () => setStatus(null),
        },
        { token: props.token }
      );
    } finally {
      setBusy(false);
    }
  };

  const seek = (s: Source) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id && tab.url?.includes("youtube.com")) {
        chrome.tabs.sendMessage(tab.id, { type: "seek", start_s: s.start_s });
      } else if (s.source_url) {
        const u = new URL(s.source_url);
        u.searchParams.set("t", String(Math.floor(s.start_s)));
        chrome.tabs.create({ url: u.toString() });
      }
    });
  };

  const rendered = useMemo(() => {
    if (!answer) return null;
    const parts = answer.split(/(\[\d+\])/g);
    return parts.map((p, i) => {
      const m = p.match(/^\[(\d+)\]$/);
      if (!m) return <span key={i}>{p}</span>;
      const src = sources.find((x) => x.i === Number(m[1]));
      if (!src) return <span key={i}>{p}</span>;
      return (
        <button key={i} class="cite" type="button" onClick={() => seek(src)}>
          {src.episode} · {ts(src.start_s)}
        </button>
      );
    });
  }, [answer, sources]);

  return (
    <>
      <div class="field">
        <label>Catalog</label>
        <select
          value={catalogId}
          onChange={(e) => {
            const id = (e.target as HTMLSelectElement).value;
            setCatalogId(id);
            props.onSelect(id);
          }}
          style={{
            width: "100%",
            background: "var(--panel)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <option value="">Select…</option>
          {indexed.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div class="field">
        <label>Question</label>
        <textarea
          rows={3}
          placeholder="What has the creator said about…?"
          value={question}
          onInput={(e) => setQuestion((e.target as HTMLTextAreaElement).value)}
        />
      </div>
      <button class="btn" disabled={busy || !catalogId || question.trim().length < 3} onClick={ask}>
        {busy ? "Asking…" : "Ask"}
      </button>
      {status && (
        <div class="meta" style={{ marginTop: 10 }}>
          {status}
        </div>
      )}
      {rendered && <div class="answer">{rendered}</div>}
    </>
  );
}

function ProfileTab(props: {
  profile: Profile;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
  onError: (s: string | null) => void;
}) {
  const p = props.profile;
  const [name, setName] = useState(p.display_name || "");
  const [key, setKey] = useState("");
  const usedPct = Math.min(100, Math.round((p.asks_today / Math.max(1, p.daily_cap)) * 100));

  return (
    <>
      <div class="card">
        <h3>Usage today</h3>
        <div class="meta">
          {p.free_left} free left of {p.daily_cap} · {p.extra_credits} extra credits
        </div>
        <div class="meter">
          <i style={{ width: `${usedPct}%` }} />
        </div>
        <button
          class="btn ghost"
          style={{ width: "100%", marginTop: 8 }}
          onClick={() => {
            window.open(
              "mailto:hello@backcat.app?subject=Buy%20more%20Backcat%20credits",
              "_blank"
            );
          }}
        >
          Buy more credits
        </button>
        <div class="meta" style={{ marginTop: 6 }}>
          Checkout (Paddle) lands next — this opens a mailto stub for now.
        </div>
      </div>

      <div class="field">
        <label>Display name</label>
        <div class="row">
          <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          <button
            class="btn ghost"
            style={{ flex: "0 0 auto" }}
            onClick={async () => {
              try {
                await updateDisplayName(name);
                await props.onRefresh();
              } catch (e: unknown) {
                props.onError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Save
          </button>
        </div>
      </div>

      <div class="card">
        <h3>Your Anthropic key (BYOK)</h3>
        <div class="meta" style={{ marginBottom: 8 }}>
          {p.byok_configured
            ? `Configured · …${p.byok_last4}`
            : "When free + credits are gone, asks use your key (Backcat LLM spend = $0)."}
        </div>
        <input
          type="password"
          placeholder="sk-ant-…"
          value={key}
          onInput={(e) => setKey((e.target as HTMLInputElement).value)}
        />
        <div class="row" style={{ marginTop: 8 }}>
          <button
            class="btn"
            disabled={key.trim().length < 20}
            onClick={async () => {
              try {
                await saveByok(key.trim());
                setKey("");
                await props.onRefresh();
              } catch (e: unknown) {
                props.onError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            Save key
          </button>
          {p.byok_configured && (
            <button
              class="btn danger"
              onClick={async () => {
                await clearByok();
                await props.onRefresh();
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <button class="btn ghost" style={{ width: "100%" }} onClick={props.onLogout}>
        Sign out
      </button>
    </>
  );
}
