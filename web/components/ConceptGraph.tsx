"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SERVE_URL, ts, youtubeId } from "@/lib/ask";
import { TYPE_COLORS, epColor, type GraphEpisode } from "@/lib/graph-style";
import "./concept-graph.css";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export type { GraphEpisode };
export { TYPE_COLORS, epColor };

const INK = "#c9c9cf";

type GNode = {
  id: string;
  name: string;
  label: string;
  mentions: number;
  episodes: number;
  episode_ids?: string[];
  episode_titles?: string[];
  primary_episode?: string | null;
};
type GLink = { source: string | { id: string }; target: string | { id: string }; weight: number; kind?: string };
type GraphPayload = { nodes: GNode[]; links: GLink[]; episodes?: GraphEpisode[] };
type Moment = {
  episode: string;
  episode_id?: string;
  source_url?: string | null;
  start_s: number;
  end_s: number;
  text: string;
};

function linkId(end: GLink["source"]): string {
  return typeof end === "string" ? end : end.id;
}

function epIndex(episodes: GraphEpisode[], id: string): number {
  const i = episodes.findIndex((e) => e.id === id);
  return i >= 0 ? i + 1 : 0;
}

function epLabel(episodes: GraphEpisode[], id: string | undefined, title?: string): string {
  if (!id) return title || "episode";
  const n = epIndex(episodes, id);
  const t = title || episodes.find((e) => e.id === id)?.title || "episode";
  return n > 0 ? `EP ${n} · ${t}` : t;
}

function MomentsPanel({
  node,
  episodes,
  episodeFilter,
  onClose,
}: {
  node: GNode;
  episodes: GraphEpisode[];
  episodeFilter: string | null;
  onClose: () => void;
}) {
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [playing, setPlaying] = useState<Moment | null>(null);

  useEffect(() => {
    setMoments(null);
    setPlaying(null);
    const qs = new URLSearchParams({ uid: node.id });
    if (episodeFilter) qs.set("episode_id", episodeFilter);
    fetch(`${SERVE_URL}/api/concepts/chunks?${qs}`)
      .then((r) => (r.ok ? r.json() : { moments: [] }))
      .then((d) => setMoments(d.moments))
      .catch(() => setMoments([]));
  }, [node.id, episodeFilter]);

  const vid = playing ? youtubeId(playing.source_url) : null;
  const groups = useMemo(() => {
    if (!moments) return [];
    const map = new Map<string, Moment[]>();
    for (const m of moments) {
      const key = m.episode_id || m.episode;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()];
  }, [moments]);

  return (
    <div className="gpanel">
      <div className="gpanel-head">
        <span
          className="gpanel-dot"
          style={{
            background:
              node.label === "Category"
                ? "transparent"
                : episodeFilter
                  ? TYPE_COLORS[node.label] ?? TYPE_COLORS.Concept
                  : epColor(node.primary_episode),
            border: node.label === "Category" ? `2px solid ${INK}` : "none",
            boxShadow:
              node.label === "Category" ? "none" : `0 0 10px ${epColor(node.primary_episode)}66`,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="gpanel-name" dir="auto">
            {node.name}
          </div>
          <div className="gpanel-meta mono">
            {node.label.toLowerCase()} · {moments ? `${moments.length} moments` : "…"}
            {node.episodes > 1 ? ` · ${node.episodes} episodes` : ""}
          </div>
        </div>
        <button className="player-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {node.episode_titles && node.episode_titles.length > 0 && (
        <div className="gpanel-eps">
          {(node.episode_ids ?? []).slice(0, 6).map((id, i) => (
            <span key={id} className="ep-pill" style={{ color: epColor(id), borderColor: `${epColor(id)}66` }}>
              {epLabel(episodes, id, node.episode_titles?.[i]).split(" · ").slice(0, 1).join("")}
              {node.episode_titles?.[i] ? (
                <span className="ep-pill-title" dir="auto">
                  {node.episode_titles[i]}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      )}

      {vid && playing && (
        <div className="gpanel-player">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${vid}?start=${Math.floor(playing.start_s)}&autoplay=1&rel=0`}
            title={playing.episode}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      <div className="gpanel-list">
        {moments === null && <p className="g-empty">loading moments…</p>}
        {moments?.length === 0 && <p className="g-empty">no linked moments</p>}
        {groups.map(([key, rows]) => {
          const eid = rows[0]?.episode_id;
          return (
            <div key={key} className="gpanel-epgroup">
              <div className="gpanel-epgroup-h">
                <i style={{ background: epColor(eid) }} />
                <span dir="auto">{rows[0]?.episode}</span>
              </div>
              {rows.map((m, i) => {
                const playable = !!youtubeId(m.source_url);
                const active = playing === m;
                return (
                  <button
                    key={`${key}-${i}`}
                    className={`gmoment${active ? " active" : ""}`}
                    onClick={() => playable && setPlaying(m)}
                    disabled={!playable}
                  >
                    <span className="ep-pill gmoment-pill">
                      {eid && epIndex(episodes, eid) > 0 ? `EP ${epIndex(episodes, eid)} · ` : ""}
                      {playable ? "▶ " : ""}
                      {ts(m.start_s)}
                    </span>
                    <span className="gmoment-body">
                      <span className="gmoment-text" dir="auto">
                        {m.text.slice(0, 140)}
                        {m.text.length > 140 ? "…" : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EpisodeFilter({
  episodes,
  value,
  onChange,
}: {
  episodes: GraphEpisode[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const qn = q.trim().toLowerCase();
  const shown = qn
    ? episodes.filter((e) => e.title.toLowerCase().includes(qn))
    : [...episodes].reverse();
  const cap = open ? shown.length : Math.min(shown.length, 8);
  const visible = shown.slice(0, cap);
  const rest = shown.length - visible.length;

  if (episodes.length === 0) return null;

  return (
    <div className="g-epbar">
      <div className="g-epbar-head">
        <span className="g-epbar-label mono">episode</span>
        <input
          className="g-search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value) setOpen(true);
          }}
          placeholder={episodes.length > 6 ? `Search ${episodes.length} episodes…` : "Filter episodes…"}
          aria-label="Filter episodes"
        />
        {value && (
          <button className="g-clear" onClick={() => onChange(null)}>
            All episodes
          </button>
        )}
      </div>
      <div className="g-epchips">
        <button
          className={`g-epchip${!value ? " on" : ""}`}
          onClick={() => onChange(null)}
        >
          All
        </button>
        {visible.map((e) => {
          const n = epIndex(episodes, e.id);
          return (
            <button
              key={e.id}
              className={`g-epchip${value === e.id ? " on" : ""}`}
              style={
                value === e.id || !value
                  ? { borderColor: `${epColor(e.id)}88`, color: value === e.id ? epColor(e.id) : undefined }
                  : undefined
              }
              onClick={() => onChange(value === e.id ? null : e.id)}
              title={e.title}
            >
              <i style={{ background: epColor(e.id) }} />
              <span className="g-epchip-num">EP {n || "·"}</span>
              <span className="g-epchip-title" dir="auto">
                {e.title}
              </span>
            </button>
          );
        })}
        {rest > 0 && (
          <button className="g-epchip g-epchip-more" onClick={() => setOpen(true)}>
            +{rest} more
          </button>
        )}
        {open && shown.length > 8 && (
          <button className="g-epchip g-epchip-more" onClick={() => setOpen(false)}>
            collapse
          </button>
        )}
      </div>
    </div>
  );
}

export default function ConceptGraph({
  catalogId,
  episodes: episodesProp = [],
  compact = false,
}: {
  catalogId: string;
  episodes?: GraphEpisode[];
  compact?: boolean;
}) {
  const [data, setData] = useState<GraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GNode | null>(null);
  const [hover, setHover] = useState<GNode | null>(null);
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"map" | "list">(() =>
    typeof window !== "undefined" && window.innerWidth < 720 ? "list" : "map"
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<{
    d3Force: (name: string) => { strength?: (n: number) => void; distance?: (fn: (l: GLink) => number) => void } | undefined;
    centerAt: (x: number, y: number, ms: number) => void;
    zoom: (k: number, ms: number) => void;
  } | null>(null);
  const [width, setWidth] = useState(720);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const obs = new ResizeObserver((e) => {
      const w = e[0].contentRect.width;
      setWidth(w);
      setNarrow(w < 720);
    });
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
    setSelected(null);
    const qs = new URLSearchParams({ limit: compact ? "60" : "100" });
    if (episodeId) qs.set("episode_id", episodeId);
    fetch(`${SERVE_URL}/api/catalogs/${catalogId}/graph?${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setError("graph unavailable — is the extraction stage done and Neo4j running?"));
  }, [catalogId, episodeId, compact]);

  const episodes = useMemo(() => {
    if (episodesProp.length) return episodesProp;
    return data?.episodes ?? [];
  }, [episodesProp, data?.episodes]);

  const colorByEpisode = !episodeId;

  const filtered = useMemo(() => {
    if (!data) return null;
    const q = query.trim().toLowerCase();
    if (!q) return data;
    const nodes = data.nodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.episode_titles ?? []).some((t) => t.toLowerCase().includes(q))
    );
    const ids = new Set(nodes.map((n) => n.id));
    const links = data.links.filter((l) => ids.has(linkId(l.source)) && ids.has(linkId(l.target)));
    return { ...data, nodes, links };
  }, [data, query]);

  const neighborIds = useMemo(() => {
    const focus = selected ?? hover;
    if (!focus || !filtered) return null;
    const set = new Set<string>([focus.id]);
    for (const l of filtered.links) {
      const s = linkId(l.source);
      const t = linkId(l.target);
      if (s === focus.id) set.add(t);
      if (t === focus.id) set.add(s);
    }
    return set;
  }, [selected, hover, filtered]);

  const maxMentions = useMemo(() => {
    if (!filtered) return 1;
    return Math.max(...filtered.nodes.filter((n) => n.label !== "Category").map((n) => n.mentions), 1);
  }, [filtered]);

  const topLabelIds = useMemo(() => {
    if (!filtered) return new Set<string>();
    return new Set(
      [...filtered.nodes]
        .filter((n) => n.label !== "Category")
        .sort((a, b) => b.mentions - a.mentions)
        .slice(0, compact ? 5 : 8)
        .map((n) => n.id)
    );
  }, [filtered, compact]);

  const nodeColor = useCallback(
    (n: GNode) => {
      if (n.label === "Category") return INK;
      if (colorByEpisode) return epColor(n.primary_episode);
      return TYPE_COLORS[n.label] ?? TYPE_COLORS.Concept;
    },
    [colorByEpisode]
  );

  const onEngineTick = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength?.(-240);
    const link = fg.d3Force("link");
    link?.distance?.((l) => ((l as GLink).kind === "includes" ? 64 : 42));
  }, []);

  useEffect(() => {
    onEngineTick();
  }, [filtered, onEngineTick]);

  const graphHeight = compact ? (narrow ? 300 : 380) : narrow ? 360 : 620;
  const graphWidth = selected && !narrow ? Math.max(width - 360, 280) : width;

  const grouped = useMemo(() => {
    if (!filtered) return [];
    const byEp = new Map<string, GNode[]>();
    for (const n of filtered.nodes) {
      if (n.label === "Category") continue;
      const ids = n.episode_ids?.length ? n.episode_ids : ["_"];
      for (const id of ids) {
        if (episodeId && id !== episodeId) continue;
        if (!byEp.has(id)) byEp.set(id, []);
        byEp.get(id)!.push(n);
      }
    }
    const order = episodes.length
      ? episodes.map((e) => e.id).filter((id) => byEp.has(id))
      : [...byEp.keys()];
    if (byEp.has("_")) order.push("_");
    return order.map((id) => ({
      id,
      title: episodes.find((e) => e.id === id)?.title ?? "Unscoped",
      nodes: (byEp.get(id) ?? []).sort((a, b) => b.mentions - a.mentions),
    }));
  }, [filtered, episodes, episodeId]);

  if (error) return <p className="g-empty">{error}</p>;
  if (!data) return <p className="g-empty">loading graph…</p>;
  if (data.nodes.length === 0)
    return <p className="g-empty">No concepts yet — run the graph stage on an episode.</p>;

  const legendEps = colorByEpisode
    ? episodes.filter((e) => data.nodes.some((n) => n.primary_episode === e.id)).slice(0, 10)
    : [];

  return (
    <div ref={wrapRef} className={`gwrap${compact ? " compact" : ""}`}>
      <div className="g-toolbar">
        <input
          className="g-search g-search-concept"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a concept…"
          aria-label="Find a concept"
        />
        <div className="g-views" role="tablist">
          <button className={view === "map" ? "on" : ""} onClick={() => setView("map")} role="tab">
            Map
          </button>
          <button className={view === "list" ? "on" : ""} onClick={() => setView("list")} role="tab">
            By episode
          </button>
        </div>
        <span className="g-hint mono">
          {colorByEpisode ? "color = episode" : "color = type"} · click a node for moments
        </span>
      </div>

      <EpisodeFilter episodes={episodes} value={episodeId} onChange={setEpisodeId} />

      <div className="g-legend">
        {colorByEpisode ? (
          <>
            {legendEps.map((e) => (
              <button
                key={e.id}
                className="glegend glegend-btn"
                onClick={() => setEpisodeId(episodeId === e.id ? null : e.id)}
              >
                <i style={{ background: epColor(e.id), boxShadow: `0 0 8px ${epColor(e.id)}88` }} />
                <span dir="auto">EP {epIndex(episodes, e.id) || "·"}</span>
              </button>
            ))}
            {episodes.length > legendEps.length && (
              <span className="mono glegend-more">+{episodes.length - legendEps.length} episodes</span>
            )}
          </>
        ) : (
          <>
            {Object.entries(TYPE_COLORS).map(([label, color]) => (
              <span key={label} className="mono glegend">
                <i style={{ background: color }} />
                {label}
              </span>
            ))}
            <span className="mono glegend">
              <i style={{ background: "transparent", border: `2px solid ${INK}` }} />
              Category
            </span>
          </>
        )}
      </div>

      {view === "list" ? (
        <div className="g-list">
          {grouped.map((g) => (
            <section key={g.id} className="g-ep-group">
              <header className="g-ep-group-h">
                <i style={{ background: epColor(g.id === "_" ? null : g.id) }} />
                <span className="ep-pill">
                  {g.id !== "_" && epIndex(episodes, g.id) > 0 ? `EP ${epIndex(episodes, g.id)}` : "—"}
                </span>
                <h3 dir="auto">{g.title}</h3>
                <span className="mono g-ep-count">{g.nodes.length}</span>
              </header>
              <div className="g-concept-rows">
                {g.nodes.slice(0, compact ? 8 : 40).map((n) => (
                  <button
                    key={`${g.id}-${n.id}`}
                    className={`g-concept-row${selected?.id === n.id ? " on" : ""}`}
                    onClick={() => setSelected(n)}
                  >
                    <i style={{ background: nodeColor(n) }} />
                    <span dir="auto">{n.name}</span>
                    <em className="mono">{n.mentions}</em>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className={`g-stage${selected ? " has-panel" : ""}`}>
          <div className="g-canvas">
            {filtered && filtered.nodes.length === 0 ? (
              <p className="g-empty" style={{ padding: 24 }}>
                No concepts match that search.
              </p>
            ) : (
              filtered && (
                <ForceGraph2D
                  key={episodeId ?? "all"}
                  ref={fgRef as never}
                  graphData={filtered}
                  width={Math.max(graphWidth - 2, 240)}
                  height={graphHeight}
                  backgroundColor="#16161d"
                  warmupTicks={40}
                  cooldownTicks={80}
                  d3VelocityDecay={0.32}
                  onEngineStop={onEngineTick}
                  onNodeClick={(n) => {
                    const node = n as unknown as GNode & { x: number; y: number };
                    setSelected(node);
                    try {
                      fgRef.current?.centerAt(node.x, node.y, 380);
                      fgRef.current?.zoom(2.1, 380);
                    } catch {
                      /* graph not ready */
                    }
                  }}
                  onNodeHover={(n) => setHover((n as unknown as GNode) ?? null)}
                  nodeLabel={(n) => {
                    const node = n as unknown as GNode;
                    const eps = (node.episode_titles ?? []).slice(0, 3).join(" · ");
                    return node.label === "Category"
                      ? `${node.name} — category`
                      : `${node.name}\n${node.mentions} mentions${eps ? `\n${eps}` : ""}`;
                  }}
                  nodePointerAreaPaint={(node, color, ctx) => {
                    const n = node as unknown as GNode & { x: number; y: number };
                    const r = 14;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                  }}
                  nodeCanvasObject={(node, ctx, scale) => {
                    const n = node as unknown as GNode & { x: number; y: number };
                    const isCat = n.label === "Category";
                    const dim = neighborIds && !neighborIds.has(n.id);
                    const r = isCat
                      ? 5 + 1.6 * Math.sqrt(n.mentions)
                      : 3.5 + 8 * Math.sqrt(n.mentions / maxMentions);
                    ctx.globalAlpha = dim ? 0.16 : 1;
                    ctx.beginPath();
                    if (n.label === "Resource") {
                      ctx.rect(n.x - r, n.y - r, r * 2, r * 2);
                    } else {
                      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
                    }
                    if (isCat) {
                      ctx.fillStyle = "#16161d";
                      ctx.fill();
                      ctx.lineWidth = 2 / scale;
                      ctx.strokeStyle = INK;
                      ctx.stroke();
                    } else {
                      const fill = nodeColor(n);
                      ctx.fillStyle = fill;
                      ctx.fill();
                      ctx.lineWidth = 1.6 / scale;
                      ctx.strokeStyle = "#16161d";
                      ctx.stroke();
                      if (!colorByEpisode) {
                        ctx.beginPath();
                        ctx.arc(n.x, n.y, r + 2.2 / scale, 0, 2 * Math.PI);
                        ctx.strokeStyle = epColor(n.primary_episode);
                        ctx.lineWidth = 1.4 / scale;
                        ctx.stroke();
                      }
                    }
                    if (selected?.id === n.id) {
                      ctx.beginPath();
                      ctx.arc(n.x, n.y, r + 4 / scale, 0, 2 * Math.PI);
                      ctx.lineWidth = 1.6 / scale;
                      ctx.strokeStyle = "#ff8a3d";
                      ctx.shadowColor = "#ff8a3d";
                      ctx.shadowBlur = 8;
                      ctx.stroke();
                      ctx.shadowBlur = 0;
                    }
                    const showLabel =
                      !dim &&
                      (isCat ||
                        selected?.id === n.id ||
                        hover?.id === n.id ||
                        (neighborIds?.has(n.id) && selected) ||
                        topLabelIds.has(n.id) ||
                        scale > 2.4);
                    if (showLabel) {
                      const fontPx = Math.max((isCat ? 11 : 10) / scale, 2.8);
                      ctx.font = `${fontPx}px ui-sans-serif, system-ui, sans-serif`;
                      ctx.textAlign = "center";
                      ctx.fillStyle = isCat ? "#f3f2ee" : "#e8e8ee";
                      const label = n.name.length > 28 ? `${n.name.slice(0, 26)}…` : n.name;
                      ctx.fillText(label, n.x, n.y + r + Math.max(11 / scale, 3.5));
                    }
                    ctx.globalAlpha = 1;
                  }}
                  linkColor={(l) => {
                    const link = l as unknown as GLink;
                    const s = linkId(link.source);
                    const t = linkId(link.target);
                    const hot = !neighborIds || neighborIds.has(s) || neighborIds.has(t);
                    if (!hot) return "rgba(110,110,120,0.06)";
                    return link.kind === "includes"
                      ? "rgba(201,201,207,0.32)"
                      : "rgba(110,110,120,0.28)";
                  }}
                  linkLineDash={(l) => ((l as unknown as GLink).kind === "includes" ? [3, 3] : null)}
                  linkWidth={(l) => {
                    const link = l as unknown as GLink;
                    const s = linkId(link.source);
                    const t = linkId(link.target);
                    const hot = !neighborIds || neighborIds.has(s) || neighborIds.has(t);
                    return hot ? Math.min(0.8 + link.weight * 0.35, 3) : 0.4;
                  }}
                />
              )
            )}
          </div>
          {selected && (
            <MomentsPanel
              node={selected}
              episodes={episodes}
              episodeFilter={episodeId}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      )}

      {view === "list" && selected && (
        <MomentsPanel
          node={selected}
          episodes={episodes}
          episodeFilter={episodeId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
