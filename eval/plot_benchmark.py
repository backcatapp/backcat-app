"""Render the benchmark results as brand-palette charts.

Numbers are computed from results JSON at render time — a chart in this repo
can never disagree with the run that produced it.

Emits standalone HTML (no dependencies, no network required); screenshot with:
    msedge --headless --screenshot=out.png --window-size=1200,675 \
           --force-device-scale-factor=2 file:///.../hit5.html

Usage:
    python eval/plot_benchmark.py [--results PATH] [--out DIR]
"""

import argparse
import json
from pathlib import Path

CONFIGS = ("baseline", "baseline+rerank", "graph", "graph+rerank")

# Brand Book palette.
EIGENGRAU = "#16161D"
RAISED = "#1F1F28"
LINES = "#2C2C36"
SMOKE = "#6E6E78"
SECONDARY = "#C9C9CF"
MILK = "#F3F2EE"
TABBY = "#FF8A3D"
HONEY = "#E8B03E"

FONT_SANS = "'Instrument Sans','Segoe UI',system-ui,sans-serif"
FONT_MONO = "'IBM Plex Mono','Cascadia Mono',Consolas,monospace"

CSS = f"""
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{
  width:1200px; height:675px; background:{EIGENGRAU};
  font-family:{FONT_SANS}; padding:48px 56px;
  display:flex; flex-direction:column;
}}
.eyebrow {{
  font-family:{FONT_MONO}; font-size:13px; letter-spacing:.14em;
  text-transform:uppercase; color:{SMOKE}; margin-bottom:14px;
}}
h1 {{ font-size:38px; font-weight:700; color:{MILK}; letter-spacing:-.02em; line-height:1.15; }}
.sub {{ font-size:17px; color:{SECONDARY}; margin-top:10px; }}
.plot {{ flex:1; display:flex; flex-direction:column; justify-content:center; gap:18px; margin:30px 0 0; }}
.row {{ display:flex; align-items:center; gap:18px; }}
.label {{ width:250px; text-align:right; font-size:17px; color:{SECONDARY}; flex-shrink:0; }}
.label b {{ color:{MILK}; font-weight:600; }}
.track {{ flex:1; position:relative; height:38px; background:{RAISED}; border-radius:8px; }}
.bar {{ position:absolute; left:0; top:0; bottom:0; border-radius:8px; }}
.value {{
  width:150px; font-family:{FONT_MONO}; font-size:22px; color:{MILK};
  flex-shrink:0; display:flex; align-items:baseline; gap:10px;
}}
.delta {{ font-size:14px; color:{SMOKE}; }}
.delta.up {{ color:{TABBY}; }}
.gate {{ position:absolute; top:-9px; bottom:-9px; width:0; border-left:2px dashed {HONEY}; }}
.gate span {{
  position:absolute; top:-24px; left:8px; white-space:nowrap;
  font-family:{FONT_MONO}; font-size:12px; color:{HONEY};
}}
.axis {{ display:flex; gap:18px; margin-top:6px; }}
.axis .label {{ width:250px; }}
.axis .ticks {{ flex:1; display:flex; justify-content:space-between;
  font-family:{FONT_MONO}; font-size:12px; color:{SMOKE}; }}
.axis .pad {{ width:150px; flex-shrink:0; }}
footer {{
  margin-top:26px; padding-top:18px; border-top:1px solid {LINES};
  display:flex; justify-content:space-between; align-items:center;
  font-family:{FONT_MONO}; font-size:13px; color:{SMOKE};
}}
footer b {{ color:{SECONDARY}; font-weight:500; }}
.grp {{ display:flex; flex-direction:column; gap:9px; }}
.grp + .grp {{ margin-top:26px; }}
.grp .cat {{ font-size:15px; color:{MILK}; font-weight:600; margin-bottom:2px; }}
"""


def summarize(results: list[dict]) -> dict:
    cats = sorted({r["category"] for r in results}) + ["overall"]
    out: dict[str, dict] = {}
    for cat in cats:
        rows = results if cat == "overall" else [r for r in results if r["category"] == cat]
        out[cat] = {"n": len(rows)}
        for cfg in CONFIGS:
            out[cat][cfg] = {
                m: sum(r[cfg][m] for r in rows) / len(rows)
                for m in ("hit@k", "mrr", "recall@k")
            }
    return out


def _page(title: str, body: str) -> str:
    return (
        f"<!doctype html><html><head><meta charset='utf-8'><title>{title}</title>"
        f"<style>{CSS}</style></head><body>{body}</body></html>"
    )


def chart_hit5(s: dict, n: int) -> str:
    """Headline chart: hit@5 per config on a truncated axis (labelled)."""
    lo, hi = 0.70, 1.00
    base = s["overall"]["baseline"]["hit@k"]
    order = [
        ("dense + BM25", "baseline", SMOKE),
        ("+ knowledge graph", "graph", SMOKE),
        ("+ reranker", "baseline+rerank", TABBY),
        ("graph + reranker", "graph+rerank", TABBY),
    ]

    def pct(v: float) -> float:
        return max(0.0, min(1.0, (v - lo) / (hi - lo))) * 100

    rows = []
    for label, cfg, color in order:
        v = s["overall"][cfg]["hit@k"]
        d = (v - base) * 100
        if cfg == "baseline":
            delta = "<span class='delta'>baseline</span>"
        else:
            cls = "delta up" if d > 0 else "delta"
            delta = f"<span class='{cls}'>{d:+.1f} pts</span>"
        rows.append(
            f"<div class='row'>"
            f"<div class='label'><b>{label}</b></div>"
            f"<div class='track'><div class='bar' style='width:{pct(v):.2f}%;background:{color}'></div>"
            f"<div class='gate' style='left:{pct(0.85):.2f}%'>"
            f"{'<span>0.85 quality bar</span>' if cfg == 'baseline' else ''}</div>"
            f"</div>"
            f"<div class='value'>{v:.3f} {delta}</div>"
            f"</div>"
        )

    axis = (
        "<div class='axis'><div class='label'></div>"
        f"<div class='ticks'><span>{lo:.2f}</span><span>0.80</span><span>0.90</span>"
        f"<span>{hi:.2f}</span></div><div class='pad'></div></div>"
    )
    body = (
        "<div class='eyebrow'>Backcat · retrieval benchmark</div>"
        "<h1>The knowledge graph made retrieval worse.<br>The reranker fixed it.</h1>"
        f"<div class='sub'>hit@5 over {n} golden questions, four retrieval configurations</div>"
        f"<div class='plot'>{''.join(rows)}{axis}</div>"
        "<footer><span>12 episodes · 3.07 audio-hours · one catalog · bge-reranker-v2-m3</span>"
        "<span><b>axis starts at 0.70</b></span></footer>"
    )
    return _page("hit@5 by configuration", body)


def chart_recall(s: dict) -> str:
    """Counterpoint chart: recall@5 gains from the graph channel."""
    groups = [("multi_hop", "multi-hop questions"), ("temporal", "temporal questions")]
    blocks = []
    for cat, pretty in groups:
        n = s[cat]["n"]
        b = s[cat]["baseline"]["recall@k"]
        g = s[cat]["graph"]["recall@k"]
        blocks.append(
            f"<div class='grp'><div class='cat'>{pretty} &nbsp;<span style='color:{SMOKE};"
            f"font-family:{FONT_MONO};font-size:13px;font-weight:400'>n={n}</span></div>"
            f"<div class='row'><div class='label'>dense + BM25</div>"
            f"<div class='track'><div class='bar' style='width:{b*100:.1f}%;background:{SMOKE}'></div></div>"
            f"<div class='value'>{b:.2f}</div></div>"
            f"<div class='row'><div class='label'><b>+ knowledge graph</b></div>"
            f"<div class='track'><div class='bar' style='width:{g*100:.1f}%;background:{TABBY}'></div></div>"
            f"<div class='value'>{g:.2f} <span class='delta up'>{(g-b)*100:+.0f} pts</span></div></div>"
            f"</div>"
        )
    axis = (
        "<div class='axis' style='margin-top:16px'><div class='label'></div>"
        "<div class='ticks'><span>0.00</span><span>0.25</span><span>0.50</span>"
        "<span>0.75</span><span>1.00</span></div><div class='pad'></div></div>"
    )
    body = (
        "<div class='eyebrow'>Backcat · retrieval benchmark</div>"
        "<h1>Where the graph earns its place</h1>"
        "<div class='sub'>recall@5 — the graph finds chunks dense and keyword search both miss</div>"
        f"<div class='plot' style='justify-content:center'>{''.join(blocks)}{axis}</div>"
        "<footer><span>small samples — read as directional, not conclusive</span>"
        "<span><b>graph channel, no reranker</b></span></footer>"
    )
    return _page("recall@5 gains from the graph channel", body)


def main() -> None:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", type=Path, default=here / "results" / "day10_benchmark.json")
    ap.add_argument("--out", type=Path, default=here / "results")
    args = ap.parse_args()

    data = json.loads(args.results.read_text(encoding="utf-8"))
    s = summarize(data)
    args.out.mkdir(parents=True, exist_ok=True)

    for name, html in (
        ("benchmark-hit5", chart_hit5(s, len(data))),
        ("benchmark-recall", chart_recall(s)),
    ):
        p = args.out / f"{name}.html"
        p.write_text(html, encoding="utf-8")
        print(p)


if __name__ == "__main__":
    main()
