import Link from "next/link";
import AskChat from "@/components/AskChat";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TestChatPage({
  searchParams,
}: {
  searchParams: Promise<{ catalog?: string }>;
}) {
  const { catalog: selectedId } = await searchParams;
  const catalogs = await sql`SELECT id, name FROM catalogs ORDER BY name`;
  const selected = catalogs.find((c) => c.id === selectedId) ?? catalogs[0];

  return (
    <>
      <h1>Test chat</h1>
      <p className="dash-sub">
        The exact experience fans get on the public page (
        {selected ? (
          <a href={`/c/${selected.id}`} target="_blank">
            /c/{selected.id}
          </a>
        ) : (
          "no catalogs yet"
        )}
        ) — same API, same guardrails, same rate limits.
      </p>

      {catalogs.length > 1 && (
        <div className="catalog-row-actions" style={{ marginBottom: 20 }}>
          {catalogs.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/ask?catalog=${c.id}`}
              className={`chip${c.id === selected?.id ? " running" : ""}`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {selected ? (
        <div style={{ maxWidth: 720 }}>
          <AskChat key={selected.id} catalogId={selected.id} />
        </div>
      ) : (
        <p className="dash-sub">
          Add a catalog first: <code>ingest add &lt;rss_url&gt;</code>
        </p>
      )}
    </>
  );
}
