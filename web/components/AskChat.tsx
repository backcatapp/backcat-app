"use client";

import { useCallback, useRef, useState } from "react";
import { askStream, Source, ts } from "@/lib/ask";
import "./askchat.css";

type Answer = {
  question: string;
  text: string;
  sources: Source[];
  state: "thinking" | "streaming" | "done" | "absence" | "error";
  note?: string;
};

/** Render answer text, replacing [n] markers with citation pills. */
function AnswerText({
  text,
  sources,
  streaming,
  onCite,
}: {
  text: string;
  sources: Source[];
  streaming: boolean;
  onCite: (i: number) => void;
}) {
  const parts: React.ReactNode[] = [];
  const re = /\[(\d+)\]/g;
  let last = 0;
  let m;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const n = parseInt(m[1], 10);
    const src = sources.find((s) => s.i === n);
    if (src) {
      parts.push(
        <button key={key++} className="cite" title={src.episode} onClick={() => onCite(n)}>
          <b>{n}</b> {ts(src.start_s)}
        </button>
      );
    } else {
      parts.push(m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <div className="chat-a-text" dir="auto">
      {parts}
      {streaming && <span className="cursor" />}
    </div>
  );
}

export default function AskChat({
  catalogId,
  placeholder = "Ask anything about this catalog…",
}: {
  catalogId: string;
  placeholder?: string;
}) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [flashed, setFlashed] = useState<number | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const patchLast = useCallback((patch: Partial<Answer> | ((a: Answer) => Partial<Answer>)) => {
    setAnswers((prev) => {
      const next = [...prev];
      const a = next[next.length - 1];
      next[next.length - 1] = { ...a, ...(typeof patch === "function" ? patch(a) : patch) };
      return next;
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    setAnswers((prev) => [...prev, { question, text: "", sources: [], state: "thinking" }]);
    requestAnimationFrame(() =>
      threadRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
    );
    try {
      await askStream(catalogId, question, {
        onSources: (sources) => patchLast({ sources, state: "streaming" }),
        onDelta: (text) => patchLast((a) => ({ text: a.text + text })),
        onAbsence: (note) => patchLast({ state: "absence", note }),
        onError: (note) => patchLast({ state: "error", note }),
        onDone: () => patchLast({ state: "done" }),
      });
    } catch {
      patchLast({ state: "error", note: "could not reach the answer service" });
    } finally {
      setBusy(false);
    }
  };

  const flashSource = (i: number) => {
    setFlashed(null);
    requestAnimationFrame(() => setFlashed(i));
  };

  return (
    <div className="chat">
      <div className="chat-thread" ref={threadRef}>
        {answers.length === 0 && (
          <div className="chat-empty">
            Answers come from the actual episodes — every claim cited to the second.
            <br />
            If it isn&apos;t covered, you&apos;ll be told honestly.
          </div>
        )}
        {answers.map((a, idx) => (
          <div key={idx} style={{ display: "contents" }}>
            <div className="chat-q" dir="auto">
              {a.question}
            </div>
            {a.state === "thinking" && (
              <div className="chat-thinking" aria-label="thinking">
                <i /> <i /> <i />
              </div>
            )}
            {(a.state === "streaming" || a.state === "done") && (
              <div className="chat-a">
                <AnswerText
                  text={a.text}
                  sources={a.sources}
                  streaming={a.state === "streaming"}
                  onCite={flashSource}
                />
                {a.sources.length > 0 && a.state === "done" && (
                  <div className="chat-sources">
                    {a.sources.map((s) => (
                      <div
                        key={s.i}
                        className={`chat-source${flashed === s.i && idx === answers.length - 1 ? " flash" : ""}`}
                      >
                        <span className="mono-ts">
                          [{s.i}] {ts(s.start_s)}–{ts(s.end_s)}
                        </span>
                        <span>{s.episode}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {a.state === "absence" && (
              <div className="chat-absence">
                <b>Not covered — honestly.</b>
                {a.note}
              </div>
            )}
            {a.state === "error" && <div className="chat-error">{a.note}</div>}
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input
          className="chat-input"
          dir="auto"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          maxLength={1000}
          aria-label="Your question"
        />
        <button className="chat-send" disabled={busy || input.trim().length < 3}>
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
