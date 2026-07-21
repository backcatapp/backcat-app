import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AskChat from "@/components/AskChat";
import { sql } from "@/lib/db";
import "./fanpage.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function getCatalog(id: string) {
  const [catalog] = await sql`
    SELECT c.id, c.name,
      (SELECT count(*)::int FROM episodes e WHERE e.catalog_id = c.id) AS episodes,
      (SELECT coalesce(round(sum(t.audio_duration_s) / 3600, 1), 0)
         FROM transcripts t WHERE t.catalog_id = c.id) AS hours
    FROM catalogs c WHERE c.id = ${id}
  `;
  return catalog ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const catalog = await getCatalog(id);
  if (!catalog) return { title: "backcat" };
  return {
    title: `Ask ${catalog.name} anything — backcat`,
    description: `Every answer grounded in the actual episodes, cited to the exact second.`,
  };
}

export default async function FanPage({ params }: Props) {
  const { id } = await params;
  const catalog = await getCatalog(id);
  if (!catalog) notFound();

  return (
    <div className="fan">
      <div className="fan-inner">
        <header className="fan-top">
          <Link href="/" className="fan-wordmark">
            back<span>cat</span>
          </Link>
          <span className="fan-live">
            <i /> catalog live
          </span>
        </header>

        <section className="fan-hero">
          <div className="fan-kicker">Your back catalog, answering</div>
          <h1>
            Ask <em>{catalog.name}</em> anything
          </h1>
          <p>
            Answers come from the actual episodes — grounded in the creator&apos;s own words and
            cited to the exact second. Nothing invented.
          </p>
          <div className="fan-stats">
            <span>{catalog.episodes} episodes indexed</span>
            <span>{Number(catalog.hours)}h of audio</span>
          </div>
        </section>

        <section className="fan-chat">
          <AskChat catalogId={catalog.id} placeholder={`Ask ${catalog.name} anything…`} />
        </section>

        <footer className="fan-foot">
          Powered by <a href="/">Backcat</a> — cited answers from creator catalogs
        </footer>
      </div>
    </div>
  );
}
