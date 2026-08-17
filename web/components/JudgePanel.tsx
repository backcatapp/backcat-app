"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveJudgment } from "@/app/dashboard/actions";

type PoolItem = {
  chunk_id: string;
  text: string;
  start_s: number;
  end_s: number;
  episode: string;
  source_url: string | null;
  channels: string[];
  priority: number;
  label: number | null;
  in_generated_key: boolean;
};

const LABELS = [
  { value: 0, key: "1", text: "Not relevant" },
  { value: 1, key: "2", text: "Related" },
  { value: 2, key: "3", text: "Answers it" },
];

function ts(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function JudgePanel({
  questionId,
  question,
  category,
  items,
}: {
  questionId: string;
  question: string;
  category: string;
  items: PoolItem[];
}) {
  const router = useRouter();
  const [labels, setLabels] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      items.filter((i) => i.label !== null).map((i) => [i.chunk_id, i.label as number]),
    ),
  );
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    rowRefs.current[cursor]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [cursor]);

  const label = useCallback(
    (index: number, value: number) => {
      const item = items[index];
      if (!item) return;
      setLabels((prev) => ({ ...prev, [item.chunk_id]: value }));
      setCursor((c) => Math.min(c + 1, items.length - 1));
      saveJudgment(questionId, item.chunk_id, value).catch((e: Error) =>
        setError(e.message ?? "could not save"),
      );
    },
    [items, questionId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const hit = LABELS.find((l) => l.key === e.key);
      if (hit) {
        e.preventDefault();
        label(cursor, hit.value);
      } else if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, items.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        router.push("/dashboard/eval");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, items.length, label, router]);

  const done = items.filter((i) => labels[i.chunk_id] !== undefined).length;

  return (
    <div className="judge">
      <div className="judge-head">
        <div>
          <span className="chip">{category}</span>
          <span className="chip queued">
            {done}/{items.length} labelled
          </span>
        </div>
        <div className="judge-keys mono">
          1 not relevant · 2 related · 3 answers it · j/k move · enter next question
        </div>
      </div>

      <p className="judge-question" dir="auto">
        {question}
      </p>

      {error && <div className="err">{error}</div>}

      <div className="judge-list">
        {items.map((item, i) => {
          const value = labels[item.chunk_id];
          return (
            <div
              key={item.chunk_id}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className={`judge-row${i === cursor ? " active" : ""}${
                value !== undefined ? ` labelled-${value}` : ""
              }`}
              onClick={() => setCursor(i)}
            >
              <div className="judge-meta mono">
                <span>{item.episode}</span>
                <span>
                  {ts(Number(item.start_s))}–{ts(Number(item.end_s))}
                </span>
                {item.channels
                  .filter((c) => c !== "pool")
                  .map((c) => (
                    <span key={c} className="chip">
                      {c}
                    </span>
                  ))}
                {item.in_generated_key && <span className="chip running">generated key</span>}
                {item.priority === 2 && <span className="chip queued">beyond top-5</span>}
              </div>

              <p className="judge-text" dir="auto">
                {item.text}
              </p>

              <div className="judge-actions">
                {LABELS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    className={`btn-ghost${value === l.value ? " picked" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      label(i, l.value);
                    }}
                  >
                    <span className="mono">{l.key}</span> {l.text}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" className="btn" onClick={() => router.push("/dashboard/eval")}>
        Next question
      </button>
    </div>
  );
}
