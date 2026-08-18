import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AskChat from "@/components/AskChat";
import ConceptGraph from "@/components/ConceptGraph";
import ShareButton from "@/components/ShareButton";
import { sql } from "@/lib/db";
import { youtubeId } from "@/lib/ask";
import { epColor, type GraphEpisode } from "@/lib/graph-style";
import "./fanpage.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const SERVE_INTERNAL = process.env.SERVE_INTERNAL_URL ?? "http://localhost:8000";

const EQ = [
  { h: 38, c: "#FF5E7E" },
  { h: 62, c: "#FDBE33" },
  { h: 84, c: "#ff8a3d" },
  { h: 48, c: "#5AC18E" },
  { h: 70, c: "#3BAFDA" },
  { h: 44, c: "#906EE4" },
  { h: 90, c: "#E0568C" },
  { h: 56, c: "#2AA9E0" },
];

type GraphNode = {
  id: string;
  name: string;
  label: string;
  mentions: number;
  primary_episode?: string | null;
};

async function getCatalog(id: string) {
  const [catalog] = await sql`
    SELECT c.id, c.name, c.rss_url,
      (SELECT count(*)::int FROM episodes e WHERE e.catalog_id = c.id) AS episodes,
      (SELECT coalesce(round(sum(t.audio_duration_s) / 3600, 1), 0)
         FROM transcripts t WHERE t.catalog_id = c.id) AS hours
    FROM catalogs c WHERE c.id = ${id}
  `;
  return catalog ?? null;
}

async function getGraph(id: string): Promise<{ nodes: GraphNode[] }> {
  try {
    const r = await fetch(`${SERVE_INTERNAL}/api/catalogs/${id}/graph?limit=40`, {
      cache: "no-store",
    });
    if (!r.ok) return { nodes: [] };
    return r.json();
  } catch {
    return { nodes: [] };
  }
}

function channelUrl(rss: string | null): string | null {
  if (!rss) return null;
  try {
    const cid = new URL(rss).searchParams.get("channel_id");
    return cid ? `https://www.youtube.com/channel/${cid}` : null;
  } catch {
    return null;
  }
}

function mins(seconds?: number | null): string | null {
  if (!seconds) return null;
  const m = Math.round(Number(seconds) / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m} min`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const catalog = await getCatalog(id);
  if (!catalog) return { title: "backcat" };
  return {
    title: `${catalog.name} — ask the catalog | backcat`,
    description: `Ask ${catalog.name} anything. Answers grounded in the actual episodes, cited to the exact second.`,
    openGraph: {
      title: `${catalog.name} on backcat`,
      description: `A living map of this catalog — ask anything, jump to the moment.`,
    },
  };
}

export default async function FanPage({ params }: Props) {
  const { id } = await params;
  const catalog = await getCatalog(id);
  if (!catalog) notFound();

  const [episodes, graph] = await Promise.all([
    sql`
      SELECT e.id, e.title, e.source_url, e.duration_s, e.published_at
      FROM episodes e
      WHERE e.catalog_id = ${catalog.id}
      ORDER BY e.published_at ASC NULLS LAST, e.title
    `,
    getGraph(catalog.id),
  ]);

  const graphEpisodes: GraphEpisode[] = episodes.map((e) => ({
    id: e.id,
    title: e.title,
    source_url: e.source_url,
    duration_s: e.duration_s,
    published_at: e.published_at ? String(e.published_at) : null,
  }));

  const concepts = graph.nodes.filter((n) => n.label !== "Category").slice(0, 18);
  const prompts = concepts.slice(0, 4).map((n) => `What has been said about ${n.name}?`);
  const yt = channelUrl(catalog.rss_url);
  const newest = [...episodes].reverse();

  return (
    <div className="fan">
      <div className="fan-grid" aria-hidden>
        {Array.from({ length: 48 }).map((_, i) => (
          <i key={i} />
        ))}
      </div>

      <header className="fan-top">
        <Link href="/" className="fan-wordmark">
          back<span>cat</span>
        </Link>
        <div className="fan-top-actions">
          <span className="fan-live">
            <i /> catalog live
          </span>
          <ShareButton title={`Ask ${catalog.name} on backcat`} />
        </div>
      </header>

      <section className="fan-hero">
        <div className="fan-hero-copy">
          <p className="fan-kicker mono">Your back catalog, answering</p>
          <h1 dir="auto">{catalog.name}</h1>
          <p>
            Ask anything. Answers come from these episodes — the creator&apos;s own words, cited to
            the exact second. Nothing invented.
          </p>
          <div className="fan-stats">
            <div>
              <b>{catalog.episodes}</b>
              <span>episodes</span>
            </div>
            <div>
              <b>{Number(catalog.hours)}</b>
              <span>hours indexed</span>
            </div>
            <div>
              <b>{concepts.length || "—"}</b>
              <span>concepts</span>
            </div>
          </div>
          <div className="fan-cta">
            <a className="btn-primary fan-cta-ask" href="#ask">
              Ask this catalog
            </a>
            {yt && (
              <a className="btn-ghost-landing" href={yt} target="_blank" rel="noreferrer">
                YouTube channel
              </a>
            )}
          </div>
        </div>
        <div className="fan-hero-visual" aria-hidden>
          <div className="fan-eq">
            {EQ.map((b, i) => (
              <span
                key={i}
                style={{
                  height: `${b.h}%`,
                  background: b.c,
                  boxShadow: `0 0 14px ${b.c}88`,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
          <img className="fan-cat" src="/assets/icon.png" alt="" />
        </div>
      </section>

      <section className="fan-chat" id="ask">
        <div className="fan-card">
          <div className="fan-card-kicker mono">cited to the second</div>
          <AskChat
            catalogId={catalog.id}
            placeholder={`Ask ${catalog.name} anything…`}
            prompts={prompts}
          />
        </div>
      </section>

      {concepts.length > 0 && (
        <section className="fan-section">
          <div className="fan-section-h">
            <h2>What this catalog talks about</h2>
            <p>Concepts extracted from the transcripts. Color marks the episode they live in.</p>
          </div>
          <div className="fan-concepts">
            {concepts.map((n) => (
              <a
                key={n.id}
                className="fan-concept"
                href={`#ask`}
                title={`${n.mentions} mentions`}
              >
                <i style={{ background: epColor(n.primary_episode) }} />
                <span dir="auto">{n.name}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {newest.length > 0 && (
        <section className="fan-section">
          <div className="fan-section-h">
            <h2>Episodes</h2>
            <p>Jump to a video, or ask about a moment inside it.</p>
          </div>
          <ul className="fan-eps">
            {newest.map((e) => {
              const num = episodes.findIndex((x) => x.id === e.id) + 1;
              const vid = youtubeId(e.source_url);
              const href = e.source_url || (vid ? `https://www.youtube.com/watch?v=${vid}` : null);
              const dur = mins(e.duration_s);
              return (
                <li key={e.id}>
                  {href ? (
                    <a className="fan-ep" href={href} target="_blank" rel="noreferrer">
                      <span className="ep-pill" style={{ color: epColor(e.id), borderColor: `${epColor(e.id)}66` }}>
                        EP {num}
                        {dur ? ` · ${dur}` : ""}
                      </span>
                      <span className="fan-ep-title" dir="auto">
                        {e.title}
                      </span>
                    </a>
                  ) : (
                    <div className="fan-ep">
                      <span className="ep-pill">EP {num}</span>
                      <span className="fan-ep-title" dir="auto">
                        {e.title}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {concepts.length > 0 && (
        <section className="fan-section fan-graph-sec">
          <div className="fan-section-h">
            <h2>Concept map</h2>
            <p>
              Same graph the catalog is built from. Filter by episode, or switch to the list when
              you want every tag in one place.
            </p>
          </div>
          <div className="fan-card fan-graph-card">
            <ConceptGraph catalogId={catalog.id} episodes={graphEpisodes} compact />
          </div>
        </section>
      )}

      <footer className="fan-foot">
        Powered by <a href="/">Backcat</a> — cited answers from creator catalogs
      </footer>
    </div>
  );
}
