"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { askStream, Source, ts, youtubeId } from "@/lib/ask";
import "./askchat.css";

type Answer = {
  question: string;
  text: string;
  sources: Source[];
  state: "thinking" | "streaming" | "done" | "absence" | "error";
  note?: string;
};

type Playing = { answerIdx: number; i: number } | null;

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
      const playable = !!youtubeId(src.source_url);
      parts.push(
        <button
          key={key++}
          className={`cite${playable ? " playable" : ""}`}
          title={src.episode}
          onClick={() => onCite(n)}
        >
          {playable && <span className="cite-play">▶</span>}
          <b>{ts(src.start_s)}</b>
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

function Player({ source, onClose }: { source: Source; onClose: () => void }) {
  const vid = youtubeId(source.source_url);
  if (!vid) return null;
  const start = Math.max(0, Math.floor(source.start_s));
  return (
    <div className="player">
      <div className="player-head">
        <span className="player-title">{source.episode}</span>
        <span className="player-ts">
          {ts(source.start_s)}–{ts(source.end_s)}
        </span>
        <button className="player-close" onClick={onClose} aria-label="Close player">
          ✕
        </button>
      </div>
      <div className="player-frame">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${vid}?start=${start}&autoplay=1&rel=0`}
          title={source.episode}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
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
  const [playing, setPlaying] = useState<Playing>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const patchLast = useCallback((patch: Partial<Answer> | ((a: Answer) => Partial<Answer>)) => {
    setAnswers((prev) => {
      const next = [...prev];
      const a = next[next.length - 1];
      next[next.length - 1] = { ...a, ...(typeof patch === "function" ? patch(a) : patch) };
      return next;
    });
  }, []);

  useEffect(() => {
    if (busy) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [answers.length, busy]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    setPlaying(null);
    setAnswers((prev) => [...prev, { question, text: "", sources: [], state: "thinking" }]);
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

  const activate = (answerIdx: number, i: number) => {
    const src = answers[answerIdx]?.sources.find((s) => s.i === i);
    if (src && youtubeId(src.source_url)) {
      setPlaying((p) => (p?.answerIdx === answerIdx && p.i === i ? p : { answerIdx, i }));
      return true;
    }
    return false;
  };

  return (
    <div className="chat">
      <div className="chat-thread">
        {answers.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-mark">
              ask<span>·</span>anything
            </div>
            <p>
              Answers come from the actual episodes — every claim cited to the exact second, with
              the moment playable right here.
            </p>
            <div className="chat-empty-tags">
              <span>grounded only</span>
              <span>cited to the second</span>
              <span>honest when not covered</span>
            </div>
          </div>
        )}
        {answers.map((a, idx) => {
          const playingSrc =
            playing?.answerIdx === idx
              ? a.sources.find((s) => s.i === playing.i) ?? null
              : null;
          return (
            <div key={idx} style={{ display: "contents" }}>
              <div className="chat-q" dir="auto">
                {a.question}
              </div>
              {a.state === "thinking" && (
                <div className="chat-a chat-a-enter">
                  <div className="chat-thinking" aria-label="thinking">
                    <i /> <i /> <i />
                    <span>searching the catalog…</span>
                  </div>
                </div>
              )}
              {(a.state === "streaming" || a.state === "done") && (
                <div className="chat-a chat-a-enter">
                  <div className="chat-a-kicker">
                    <span className="dotpulse" data-live={a.state === "streaming"} />
                    cited answer
                  </div>
                  <AnswerText
                    text={a.text}
                    sources={a.sources}
                    streaming={a.state === "streaming"}
                    onCite={(i) => activate(idx, i)}
                  />
                  {playingSrc && <Player source={playingSrc} onClose={() => setPlaying(null)} />}
                  {a.sources.length > 0 && a.state === "done" && (
                    <div className="chat-sources">
                      <div className="chat-sources-label">moments</div>
                      {a.sources.map((s) => {
                        const playable = !!youtubeId(s.source_url);
                        const active = playingSrc?.i === s.i;
                        return (
                          <button
                            key={s.i}
                            className={`chat-source${active ? " active" : ""}`}
                            onClick={() => activate(idx, s.i)}
                            disabled={!playable}
                          >
                            <span className={`src-play${playable ? "" : " off"}`}>
                              {playable ? "▶" : "•"}
                            </span>
                            <span className="mono-ts">
                              {ts(s.start_s)}–{ts(s.end_s)}
                            </span>
                            <span className="src-ep">{s.episode}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {a.state === "absence" && (
                <div className="chat-absence chat-a-enter">
                  <b>Not covered — honestly.</b>
                  {a.note}
                </div>
              )}
              {a.state === "error" && <div className="chat-error">{a.note}</div>}
            </div>
          );
        })}
        <div ref={endRef} />
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
          {busy ? <span className="send-busy" /> : "Ask"}
        </button>
      </form>
    </div>
  );
}
