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

  return (
    <>
      <h1>Concept graph</h1>
      <p className="dash-sub">
        What the catalog talks about — concepts, people, and resources extracted from the
        transcripts, linked when they share a moment. Every edge carries episode + timestamp
        provenance in Neo4j.
      </p>

      {catalogs.length > 1 && (
        <div className="catalog-row-actions" style={{ marginBottom: 20 }}>
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

      {selected ? <ConceptGraph key={selected.id} catalogId={selected.id} /> : null}
    </>
  );
}
