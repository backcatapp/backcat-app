import Link from "next/link";
import ConceptGraph from "@/components/ConceptGraph";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{ catalog?: string }>;
}) {
  const { catalog: selectedId } = await searchParams;
  const catalogs = await sql`SELECT id, name FROM catalogs ORDER BY name`;
  const selected = catalogs.find((c) => c.id === selectedId) ?? catalogs[0];

  const episodes = selected
    ? await sql`
        SELECT e.id, e.title, e.source_url, e.duration_s, e.published_at
        FROM episodes e
        WHERE e.catalog_id = ${selected.id}
          AND EXISTS (SELECT 1 FROM chunks c WHERE c.episode_id = e.id)
        ORDER BY e.published_at ASC NULLS LAST, e.title
      `
    : [];

  return (
    <div className="graph-page">
      <h1>Concept graph</h1>
      <p className="dash-sub">
        Color is the episode. Linked concepts shared a moment. Click a node — every claim is a
        timestamp you can play.
      </p>

      {catalogs.length > 1 && (
        <div className="g-cat-row">
          {catalogs.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/graph?catalog=${c.id}`}
              className={`chip${c.id === selected?.id ? " running" : ""}`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {selected ? (
        <ConceptGraph
          key={selected.id}
          catalogId={selected.id}
          episodes={episodes.map((e) => ({
            id: e.id,
            title: e.title,
            source_url: e.source_url,
            duration_s: e.duration_s,
            published_at: e.published_at ? String(e.published_at) : null,
          }))}
        />
      ) : null}
    </div>
  );
}
