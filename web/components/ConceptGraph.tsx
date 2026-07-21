"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { SERVE_URL, ts, youtubeId } from "@/lib/ask";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// Validated categorical palette (dark surface #16161d) — identity by entity type.
// Category is a structural (hierarchy) node, not a series: neutral ink, hollow.
export const TYPE_COLORS: Record<string, string> = {
  Concept: "#e06a1f",
  Person: "#1f9a80",
  Resource: "#7a73e6",
};
const INK = "#c9c9cf";

type GNode = { id: string; name: string; label: string; mentions: number; episodes: number };
type GLink = { source: string; target: string; weight: number; kind?: string };
type Moment = {
  episode: string;
  source_url?: string | null;
  start_s: number;
  end_s: number;
  text: string;
};

function MomentsPanel({ node, onClose }: { node: GNode; onClose: () => void }) {
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [playing, setPlaying] = useState<Moment | null>(null);

  useEffect(() => {
    setMoments(null);
    setPlaying(null);
    fetch(`${SERVE_URL}/api/concepts/chunks?uid=${encodeURIComponent(node.id)}`)
      .then((r) => (r.ok ? r.json() : { moments: [] }))
      .then((d) => setMoments(d.moments))
      .catch(() => setMoments([]));
  }, [node.id]);

  const vid = playing ? youtubeId(playing.source_url) : null;

  return (
    <div className="gpanel">
      <div className="gpanel-head">
        <span
          className="gpanel-dot"
          style={{
            background: TYPE_COLORS[node.label] ?? "transparent",
            border: node.label === "Category" ? `2px solid ${INK}` : "none",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="gpanel-name" dir="auto">
            {node.name}
          </div>
          <div className="gpanel-meta mono">
            {node.label.toLowerCase()} · {moments ? `${moments.length} moments` : "…"}
          </div>
        </div>
        <button className="player-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

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
        {moments === null && <p className="dash-sub">loading moments…</p>}
        {moments?.length === 0 && <p className="dash-sub">no linked moments</p>}
        {moments?.map((m, i) => {
          const playable = !!youtubeId(m.source_url);
          const active = playing === m;
          return (
            <button
              key={i}
              className={`gmoment${active ? " active" : ""}`}
              onClick={() => playable && setPlaying(m)}
              disabled={!playable}
            >
              <span className="mono gmoment-ts">
                {playable ? "▶ " : ""}
                {ts(m.start_s)}
              </span>
              <span className="gmoment-body">
                <span className="gmoment-ep">{m.episode}</span>
                <span className="gmoment-text" dir="auto">
                  {m.text.slice(0, 140)}
                  {m.text.length > 140 ? "…" : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ConceptGraph({ catalogId }: { catalogId: string }) {
  const [data, setData] = useState<{ nodes: GNode[]; links: GLink[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GNode | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);

  useEffect(() => {
    const obs = new ResizeObserver((e) => setWidth(e[0].contentRect.width));
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
    setSelected(null);
    fetch(`${SERVE_URL}/api/catalogs/${catalogId}/graph`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setError("graph unavailable — is the extraction stage done and Neo4j running?"));
  }, [catalogId]);

  if (error) return <p className="dash-sub">{error}</p>;
  if (!data) return <p className="dash-sub">loading graph…</p>;
  if (data.nodes.length === 0)
    return <p className="dash-sub">No concepts yet — run the graph stage on an episode.</p>;

  const maxMentions = Math.max(...data.nodes.filter((n) => n.label !== "Category").map((n) => n.mentions), 1);
  const graphWidth = selected ? Math.max(width - 342, 360) : width;

  return (
    <div ref={wrapRef}>
      <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
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
        <span className="mono" style={{ fontSize: 12, color: "var(--dim)", marginLeft: "auto" }}>
          click a node to see its moments
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
        <div
          style={{
            border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden",
            background: "var(--bg)", flex: 1, minWidth: 0,
          }}
        >
          <ForceGraph2D
            graphData={data}
            width={graphWidth - 2}
            height={620}
            backgroundColor="#16161d"
            onNodeClick={(n) => setSelected(n as unknown as GNode)}
            nodeLabel={(n) => {
              const node = n as unknown as GNode;
              return node.label === "Category"
                ? `${node.name} — category`
                : `${node.name} — ${node.mentions} mentions`;
            }}
            nodeCanvasObject={(node, ctx, scale) => {
              const n = node as unknown as GNode & { x: number; y: number };
              const isCat = n.label === "Category";
              const r = isCat
                ? 6 + 2 * Math.sqrt(n.mentions)
                : 3 + 9 * Math.sqrt(n.mentions / maxMentions);
              ctx.beginPath();
              ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
              if (isCat) {
                ctx.fillStyle = "#16161d";
                ctx.fill();
                ctx.lineWidth = 2 / scale;
                ctx.strokeStyle = INK;
                ctx.stroke();
              } else {
                ctx.fillStyle = TYPE_COLORS[n.label] ?? "#e06a1f";
                ctx.fill();
                ctx.lineWidth = 2 / scale;
                ctx.strokeStyle = "#16161d";
                ctx.stroke();
              }
              if (selected?.id === n.id) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, r + 3 / scale, 0, 2 * Math.PI);
                ctx.lineWidth = 1.5 / scale;
                ctx.strokeStyle = "#ff8a3d";
                ctx.stroke();
              }
              if (isCat || n.mentions >= maxMentions * 0.35 || scale > 2.2) {
                ctx.font = `${isCat ? Math.max(12 / scale, 3.5) : Math.max(11 / scale, 3)}px sans-serif`;
                ctx.textAlign = "center";
                ctx.fillStyle = isCat ? "#f3f2ee" : "#c9c9cf";
                ctx.fillText(n.name, n.x, n.y + r + Math.max(12 / scale, 4));
              }
            }}
            linkColor={(l) =>
              (l as unknown as GLink).kind === "includes"
                ? "rgba(201,201,207,0.28)"
                : "rgba(110,110,120,0.35)"
            }
            linkLineDash={(l) => ((l as unknown as GLink).kind === "includes" ? [3, 3] : null)}
            linkWidth={(l) => Math.min(1 + (l as unknown as GLink).weight, 4)}
            cooldownTicks={90}
          />
        </div>
        {selected && <MomentsPanel node={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
