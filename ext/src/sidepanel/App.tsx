import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import {
  addChannel,
  clearByok,
  fetchCatalogEpisodes,
  fetchCatalogGraph,
  fetchCatalogs,
  fetchConceptMoments,
  fetchProfile,
  indexEpisode,
  lookupVideo,
  saveByok,
  saveCatalog,
  unsaveCatalog,
  updateDisplayName,
  type CatalogRow,
  type EpisodeRow,
  type GraphNode,
  type Moment,
  type Profile,
} from "../lib/api";
import { askStream, ts, type Source, youtubeId } from "../lib/ask";
import { getAccessToken, login, logout } from "../lib/auth";
import { appendChat, clearChat, loadChat, type ChatTurn } from "../lib/chat";

type Tab = "channels" | "ask" | "graph" | "profile";

const TYPE_COLORS: Record<string, string> = {
  Concept: "#e06a1f",
  Person: "#1f9a80",
  Resource: "#7a73e6",
  Category: "#c9c9cf",
};

const LABEL_ORDER = ["Category", "Concept", "Person", "Resource"];

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
    episode_id: string;
  } | null>(null);
  const [graphEpisodeId, setGraphEpisodeId] = useState<string | null>(null);

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
        if (hit) {
          setWatchCatalog({
            catalog_id: hit.catalog_id,
            catalog_name: hit.catalog_name,
            episode_id: hit.episode_id,
          });
          setGraphEpisodeId(hit.episode_id);
        }
      } catch {
        /* ignore */
      }
    });
    // Open Graph tab when content script requested it
    chrome.storage.local.get("backcat_open_graph", (data) => {
      const raw = data.backcat_open_graph as
        | string
        | { catalogId?: string; episodeId?: string }
        | undefined;
      if (!raw) return;
      const catalogId = typeof raw === "string" ? raw : raw.catalogId;
      const episodeId = typeof raw === "string" ? undefined : raw.episodeId;
      if (catalogId) {
        setSelectedCatalog(catalogId);
        if (episodeId) setGraphEpisodeId(episodeId);
        setTab("graph");
      }
      chrome.storage.local.remove("backcat_open_graph");
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
        <button class={tab === "graph" ? "active" : ""} onClick={() => setTab("graph")}>
          Graph
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
            onGraph={(id) => {
              setSelectedCatalog(id);
              setTab("graph");
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
            episodeScope={watchCatalog?.episode_id || null}
          />
        )}
        {tab === "graph" && (
          <GraphTab
            catalogs={catalogs}
            selectedId={selectedCatalog || watchCatalog?.catalog_id || catalogs[0]?.id || ""}
            onSelect={setSelectedCatalog}
            onError={setError}
            watchEpisodeId={watchCatalog?.episode_id || graphEpisodeId}
            episodeId={graphEpisodeId}
            onEpisodeScope={setGraphEpisodeId}
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
  onGraph: (id: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [episodesByCatalog, setEpisodesByCatalog] = useState<Record<string, EpisodeRow[]>>({});
  const [loadingEps, setLoadingEps] = useState<string | null>(null);

  const loadEpisodes = async (catalogId: string) => {
    if (episodesByCatalog[catalogId]) return;
    setLoadingEps(catalogId);
    try {
      const eps = await fetchCatalogEpisodes(catalogId);
      setEpisodesByCatalog((prev) => ({ ...prev, [catalogId]: eps }));
    } catch (e: unknown) {
      props.onError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingEps(null);
    }
  };

  const toggleExpand = async (catalogId: string) => {
    if (expanded === catalogId) {
      setExpanded(null);
      return;
    }
    setExpanded(catalogId);
    await loadEpisodes(catalogId);
  };

  const add = async () => {
    setBusy(true);
    props.onError(null);
    try {
      const res = await addChannel(url.trim());
      setUrl("");
      setEpisodesByCatalog((prev) => {
        const next = { ...prev };
        delete next[res.catalog_id];
        return next;
      });
      await props.onChange();
      setExpanded(res.catalog_id);
      await loadEpisodes(res.catalog_id);
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

  const refreshEpisodes = async (catalogId: string) => {
    try {
      const eps = await fetchCatalogEpisodes(catalogId);
      setEpisodesByCatalog((prev) => ({ ...prev, [catalogId]: eps }));
    } catch (e: unknown) {
      props.onError(e instanceof Error ? e.message : String(e));
    }
  };

  const onIndex = async (catalogId: string, episodeId: string) => {
    setBusy(true);
    props.onError(null);
    try {
      await indexEpisode(episodeId);
      await refreshEpisodes(catalogId);
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const eps = await fetchCatalogEpisodes(catalogId);
        setEpisodesByCatalog((prev) => ({ ...prev, [catalogId]: eps }));
        const ep = eps.find((x) => x.id === episodeId);
        if (ep?.indexed || !ep?.indexing) break;
      }
      await props.onChange();
    } catch (e: unknown) {
      props.onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Auto-expand first catalog so videos are visible without an extra click
  useEffect(() => {
    if (props.catalogs.length === 0) return;
    const first = props.catalogs[0].id;
    if (expanded == null) {
      setExpanded(first);
      void loadEpisodes(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.catalogs]);

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
          Lists recent videos. Hit Index on a video to transcribe (~$0.04/audio-hour).
        </div>
      </div>

      {props.catalogs.length === 0 ? (
        <div class="empty">No saved channels yet. Add a YouTube URL above.</div>
      ) : (
        props.catalogs.map((c) => {
          const open = expanded === c.id;
          const eps = episodesByCatalog[c.id];
          return (
            <div class="card" key={c.id}>
              <button
                type="button"
                class="card-head"
                onClick={() => void toggleExpand(c.id)}
                aria-expanded={open}
              >
                <div style={{ flex: 1, textAlign: "start" }}>
                  <h3 dir="auto">{c.name}</h3>
                  <div class="meta">
                    {c.episodes} episodes · {c.indexed ? `${c.chunks} chunks` : "listed, not indexed yet"} ·{" "}
                    {c.kinds.join(", ")}
                  </div>
                </div>
                <span class="chevron">{open ? "▾" : "▸"}</span>
              </button>

              <div class="row" style={{ marginTop: 10 }}>
                <button
                  class="btn"
                  onClick={() => props.onAsk(c.id)}
                  disabled={!c.indexed}
                  title={c.indexed ? "Ask this catalog" : "Not indexed yet — Ask needs transcripts"}
                >
                  Ask
                </button>
                <button
                  class="btn ghost"
                  onClick={() => props.onGraph(c.id)}
                  disabled={!c.indexed}
                  title={c.indexed ? "Concept graph" : "Index at least one video first"}
                >
                  Graph
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

              {open && (
                <div class="ep-list">
                  {loadingEps === c.id && !eps && <div class="meta">Loading videos…</div>}
                  {eps && eps.length === 0 && <div class="meta">No episodes listed yet.</div>}
                  {eps?.map((ep) => (
                    <div class="ep-row" key={ep.id}>
                      <div class="ep-main">
                        <a
                          class="ep-title"
                          href={ep.source_url || `https://www.youtube.com/watch?v=${ep.youtube_id}`}
                          target="_blank"
                          rel="noreferrer"
                          dir="auto"
                        >
                          {ep.title}
                        </a>
                        <span class={`badge ${ep.indexed ? "ok" : ep.indexing ? "info" : "warn"}`}>
                          {ep.indexed ? "indexed" : ep.indexing ? "indexing…" : "listed only"}
                        </span>
                      </div>
                      <div class="ep-actions">
                        {!ep.indexed && (
                          <button
                            class="btn sm"
                            disabled={busy || !!ep.indexing}
                            title="Queue Whisper → embed → graph (~$0.04/audio-hour)"
                            onClick={() => void onIndex(c.id, ep.id)}
                          >
                            {ep.indexing ? "…" : "Index"}
                          </button>
                        )}
                        <button
                          class="btn ghost sm"
                          disabled={!ep.indexed}
                          title={
                            ep.indexed
                              ? "Ask about this catalog"
                              : "Index this video first"
                          }
                          onClick={() => props.onAsk(c.id)}
                        >
                          Ask
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
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
  episodeScope: string | null;
}) {
  const [catalogId, setCatalogId] = useState(props.selectedId);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [live, setLive] = useState<{ q: string; a: string; sources: Source[] } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chatScope = props.episodeScope
    ? `ep_${props.episodeScope}`
    : catalogId
      ? `cat_${catalogId}`
      : "";

  useEffect(() => {
    if (props.selectedId) setCatalogId(props.selectedId);
  }, [props.selectedId]);

  useEffect(() => {
    if (!chatScope) {
      setTurns([]);
      return;
    }
    loadChat(chatScope).then(setTurns);
  }, [chatScope]);

  const indexed = useMemo(() => props.catalogs.filter((c) => c.indexed), [props.catalogs]);

  const ask = async () => {
    if (!catalogId || !question.trim() || !chatScope) return;
    const q = question.trim();
    setBusy(true);
    setQuestion("");
    setLive({ q, a: "", sources: [] });
    setStatus("Thinking…");
    let answer = "";
    let sources: Source[] = [];
    try {
      await askStream(
        catalogId,
        q,
        {
          onSources: (s) => {
            sources = s;
            setLive((prev) => (prev ? { ...prev, sources: s } : prev));
            setStatus("Answering…");
          },
          onDelta: (t) => {
            answer += t;
            setLive((prev) => (prev ? { ...prev, a: answer, sources } : prev));
          },
          onAbsence: (m) => {
            answer = m;
            setLive((prev) => (prev ? { ...prev, a: m, sources } : prev));
            setStatus(null);
          },
          onError: (m, code) => {
            setLive(null);
            setStatus(m);
            if (code === 402) props.onQuota();
          },
          onDone: () => setStatus(null),
        },
        { token: props.token }
      );
      if (answer) {
        const next = await appendChat(chatScope, {
          id: `t_${Date.now()}`,
          q,
          a: answer,
          sources,
          at: Date.now(),
        });
        setTurns(next);
      }
      setLive(null);
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

  const renderAnswer = (text: string, sources: Source[]) => {
    const parts = text.split(/(\[\d+\])/g);
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
  };

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

      <div class="chat-head">
        <span class="meta">
          {props.episodeScope ? "History for this video" : "History for this catalog"}
        </span>
        {turns.length > 0 && (
          <button
            class="linkish"
            type="button"
            onClick={async () => {
              if (!chatScope) return;
              await clearChat(chatScope);
              setTurns([]);
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div class="chat-thread">
        {turns.length === 0 && !live && (
          <div class="empty" style={{ padding: "20px 8px" }}>
            Ask something — past answers stay here.
          </div>
        )}
        {turns.map((t) => (
          <div class="turn" key={t.id}>
            <div class="bubble q" dir="auto">
              {t.q}
            </div>
            <div class="bubble a" dir="auto">
              {renderAnswer(t.a, t.sources)}
            </div>
          </div>
        ))}
        {live && (
          <div class="turn">
            <div class="bubble q" dir="auto">
              {live.q}
            </div>
            <div class="bubble a" dir="auto">
              {live.a ? renderAnswer(live.a, live.sources) : "…"}
            </div>
          </div>
        )}
      </div>

      <div class="field">
        <label>Question</label>
        <textarea
          rows={3}
          placeholder="What has the creator said about…?"
          value={question}
          onInput={(e) => setQuestion((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask();
            }
          }}
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
    </>
  );
}

function GraphTab(props: {
  catalogs: CatalogRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  onError: (s: string | null) => void;
  watchEpisodeId: string | null;
  episodeId: string | null;
  onEpisodeScope: (id: string | null) => void;
}) {
  const [catalogId, setCatalogId] = useState(props.selectedId);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [q, setQ] = useState("");
  const scopeEpisode = props.episodeId;

  useEffect(() => {
    if (props.selectedId) setCatalogId(props.selectedId);
  }, [props.selectedId]);

  useEffect(() => {
    if (!catalogId) return;
    setLoading(true);
    setSelected(null);
    setMoments(null);
    fetchCatalogGraph(catalogId, { episodeId: scopeEpisode, limit: 100 })
      .then((g) => setNodes(g.nodes || []))
      .catch((e: unknown) => {
        setNodes([]);
        props.onError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogId, scopeEpisode]);

  useEffect(() => {
    if (!selected) {
      setMoments(null);
      return;
    }
    setMoments(null);
    fetchConceptMoments(selected.id, scopeEpisode)
      .then(setMoments)
      .catch(() => setMoments([]));
  }, [selected, scopeEpisode]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? nodes.filter((n) => n.name.toLowerCase().includes(needle))
      : nodes;
    return [...list].sort((a, b) => b.mentions - a.mentions);
  }, [nodes, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, GraphNode[]>();
    for (const n of filtered) {
      const key = n.label || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    const keys = [
      ...LABEL_ORDER.filter((k) => map.has(k)),
      ...[...map.keys()].filter((k) => !LABEL_ORDER.includes(k)).sort(),
    ];
    return keys.map((k) => ({ label: k, nodes: map.get(k)! }));
  }, [filtered]);

  const maxMentions = filtered[0]?.mentions || 1;

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
          {props.catalogs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {!c.indexed ? " (not indexed)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div class="scope-toggle">
        <button
          type="button"
          class={!scopeEpisode ? "active" : ""}
          onClick={() => props.onEpisodeScope(null)}
        >
          Whole catalog
        </button>
        <button
          type="button"
          class={scopeEpisode ? "active" : ""}
          disabled={!props.watchEpisodeId}
          onClick={() => props.onEpisodeScope(props.watchEpisodeId)}
          title={props.watchEpisodeId ? "Concepts from the video you’re watching" : "Open a known video on YouTube"}
        >
          This video
        </button>
      </div>
      {scopeEpisode && (
        <div class="meta" style={{ marginBottom: 8 }}>
          Showing concepts mentioned in the current video only.
        </div>
      )}

      <div class="field">
        <label>Search concepts</label>
        <input
          placeholder="Filter…"
          value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="graph-legend">
        {LABEL_ORDER.map((lab) => (
          <span key={lab} class="legend-item">
            <i style={{ background: TYPE_COLORS[lab] }} />
            {lab}
          </span>
        ))}
      </div>

      {loading && <div class="meta">Loading concepts…</div>}
      {!loading && catalogId && nodes.length === 0 && (
        <div class="empty">
          {scopeEpisode
            ? "No concepts for this video yet — index it first."
            : "No graph yet — Index at least one video so concepts can be extracted."}
        </div>
      )}

      <div class="graph-groups">
        {grouped.map((g) => (
          <div class="graph-group" key={g.label}>
            <div class="graph-group-label" style={{ color: TYPE_COLORS[g.label] || "#c9c9cf" }}>
              {g.label}
              <span class="meta"> · {g.nodes.length}</span>
            </div>
            <div class="graph-cloud">
              {g.nodes.map((n) => {
                const size = 11 + Math.round((n.mentions / maxMentions) * 9);
                const color = TYPE_COLORS[n.label] || "#c9c9cf";
                const active = selected?.id === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    class={`gchip${active ? " active" : ""}`}
                    style={{
                      fontSize: size,
                      borderColor: color,
                      color: n.label === "Category" ? color : undefined,
                    }}
                    onClick={() => setSelected(n)}
                    dir="auto"
                    title={`${n.label} · ${n.mentions} mentions`}
                  >
                    {n.name}
                    <span class="chip-count">{n.mentions}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div class="card moment-panel">
          <div class="row" style={{ marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <h3 dir="auto" style={{ margin: 0 }}>
                {selected.name}
              </h3>
              <div class="meta">
                {selected.label} · {selected.mentions} mentions
                {!scopeEpisode && selected.episodes > 0 ? ` · ${selected.episodes} episodes` : ""}
              </div>
            </div>
            <button class="btn ghost sm" type="button" onClick={() => setSelected(null)}>
              ✕
            </button>
          </div>
          {moments === null && <div class="meta">Loading moments…</div>}
          {moments?.length === 0 && <div class="meta">No linked moments</div>}
          <div class="moment-list">
            {moments?.map((m, i) => (
              <a
                key={i}
                class="moment"
                href={
                  m.source_url
                    ? `${m.source_url}${m.source_url.includes("?") ? "&" : "?"}t=${Math.floor(m.start_s)}`
                    : undefined
                }
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  // Prefer seeking the open YouTube tab when possible
                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const tab = tabs[0];
                    if (tab?.id && tab.url?.includes("youtube.com")) {
                      e.preventDefault();
                      chrome.tabs.sendMessage(tab.id, { type: "seek", start_s: m.start_s });
                    }
                  });
                }}
              >
                <span class="mono">{ts(m.start_s)}</span>
                <span class="moment-body">
                  {!scopeEpisode && <span class="moment-ep">{m.episode}</span>}
                  <span dir="auto">
                    {m.text.slice(0, 160)}
                    {m.text.length > 160 ? "…" : ""}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
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
