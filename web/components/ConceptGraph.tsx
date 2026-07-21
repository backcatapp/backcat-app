"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { SERVE_URL } from "@/lib/ask";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// Validated categorical palette (dark surface #16161d) — identity by entity type.
export const TYPE_COLORS: Record<string, string> = {
  Concept: "#e06a1f",
  Person: "#1f9a80",
  Resource: "#7a73e6",
};

type GNode = { id: string; name: string; label: string; mentions: number; episodes: number };
type GLink = { source: string; target: string; weight: number };

export default function ConceptGraph({ catalogId }: { catalogId: string }) {
  const [data, setData] = useState<{ nodes: GNode[]; links: GLink[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    fetch(`${SERVE_URL}/api/catalogs/${catalogId}/graph`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setError("graph unavailable — is the extraction stage done and Neo4j running?"));
  }, [catalogId]);

  if (error) return <p className="dash-sub">{error}</p>;
  if (!data) return <p className="dash-sub">loading graph…</p>;
  if (data.nodes.length === 0)
    return <p className="dash-sub">No concepts yet — run the graph stage on an episode.</p>;

  const maxMentions = Math.max(...data.nodes.map((n) => n.mentions));

  return (
    <div ref={wrapRef}>
      <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
        {Object.entries(TYPE_COLORS).map(([label, color]) => (
          <span
            key={label}
            className="mono"
            style={{ fontSize: 12, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <i style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block" }} />
            {label}
          </span>
        ))}
        <span className="mono" style={{ fontSize: 12, color: "var(--dim)", marginLeft: "auto" }}>
          size = mentions · link = co-occurrence
        </span>
      </div>
      <div style={{ border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", background: "var(--bg)" }}>
        <ForceGraph2D
          graphData={data}
          width={width - 2}
          height={620}
          backgroundColor="#16161d"
          nodeLabel={(n) => {
            const node = n as unknown as GNode;
            return `${node.name} — ${node.mentions} mentions · ${node.episodes} ep`;
          }}
          nodeCanvasObject={(node, ctx, scale) => {
            const n = node as unknown as GNode & { x: number; y: number };
            const r = 3 + 9 * Math.sqrt(n.mentions / maxMentions);
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
            ctx.fillStyle = TYPE_COLORS[n.label] ?? "#e06a1f";
            ctx.fill();
            // 2px surface ring separates overlapping marks
            ctx.lineWidth = 2 / scale;
            ctx.strokeStyle = "#16161d";
            ctx.stroke();
            if (n.mentions >= maxMentions * 0.35 || scale > 2.2) {
              ctx.font = `${Math.max(11 / scale, 3)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.fillStyle = "#c9c9cf";
              ctx.fillText(n.name, n.x, n.y + r + Math.max(12 / scale, 4));
            }
          }}
          linkColor={() => "rgba(110,110,120,0.35)"}
          linkWidth={(l) => Math.min(1 + (l as unknown as GLink).weight, 4)}
          cooldownTicks={90}
        />
      </div>
    </div>
  );
}
