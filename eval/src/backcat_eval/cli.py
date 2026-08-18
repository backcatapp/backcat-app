"""Eval harness CLI: generate the golden set, run the benchmark, report it."""

import json
from pathlib import Path

import typer
from backcat_pipeline.db import connect

app = typer.Typer(no_args_is_help=True, add_completion=False)

DEFAULT_GOLDEN_SET = Path(__file__).resolve().parents[2] / "golden_set.json"
DEFAULT_RESULTS = Path(__file__).resolve().parents[2] / "results" / "day10_benchmark.json"


@app.command()
def generate(
    catalog: str,
    single_fact: int = typer.Option(40, "--single-fact"),
    aggregation: int = typer.Option(20, "--aggregation"),
    multi_hop: int = typer.Option(30, "--multi-hop"),
    temporal: int = typer.Option(15, "--temporal"),
    out: Path = typer.Option(DEFAULT_GOLDEN_SET, "--out"),
) -> None:
    """Generate the golden set from a catalog's real chunks + graph (day 10)."""
    from .generate import generate_golden_set

    with connect() as conn:
        row = conn.execute(
            "SELECT id FROM catalogs WHERE id = %s OR name = %s", (catalog, catalog)
        ).fetchone()
        if row is None:
            raise typer.BadParameter(f"no catalog '{catalog}'")
        catalog_id = row[0]
        questions = generate_golden_set(
            conn, catalog_id=catalog_id, n_single_fact=single_fact, n_aggregation=aggregation,
            n_multi_hop=multi_hop, n_temporal=temporal,
        )
        conn.commit()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
    by_cat: dict[str, int] = {}
    for q in questions:
        by_cat[q["category"]] = by_cat.get(q["category"], 0) + 1
    typer.echo(f"wrote {len(questions)} questions to {out}: {by_cat}")


@app.command(name="run")
def run_cmd(
    golden_set: Path = typer.Option(DEFAULT_GOLDEN_SET, "--golden-set"),
    k: int = typer.Option(5, "--k"),
    rerank_pool: int = typer.Option(30, "--rerank-pool"),
    out: Path = typer.Option(DEFAULT_RESULTS, "--out"),
) -> None:
    """Run baseline vs graph (x with/without reranker) over the golden set."""
    from .runner import run_benchmark

    questions = json.loads(golden_set.read_text(encoding="utf-8"))
    typer.echo(f"running {len(questions)} questions x 4 configs (k={k}, pool={rerank_pool})...")
    with connect() as conn:
        results = run_benchmark(conn, questions, k=k, rerank_pool=rerank_pool)
        conn.commit()  # persist query-embedding + eval-gen cost events
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    typer.echo(f"wrote {len(results)} results to {out}")


@app.command(name="import-golden")
def import_golden(golden_set: Path = typer.Option(DEFAULT_GOLDEN_SET, "--golden-set")) -> None:
    """Load the golden set into Postgres so the dashboard can queue it for judging."""
    from .human import import_golden_set

    questions = json.loads(golden_set.read_text(encoding="utf-8"))
    with connect() as conn:
        n = import_golden_set(conn, questions)
        conn.commit()
    typer.echo(f"imported {n} questions into eval_questions")


@app.command(name="build-pool")
def build_pool_cmd(
    results: Path = typer.Option(DEFAULT_RESULTS, "--results"),
    golden_set: Path = typer.Option(DEFAULT_GOLDEN_SET, "--golden-set"),
    k: int = typer.Option(5, "--k"),
) -> None:
    """Turn a benchmark run into a judging queue (needs a run with ranked_ids)."""
    from .human import build_pool

    data = json.loads(results.read_text(encoding="utf-8"))
    if not any("ranked_ids" in r for r in data):
        raise typer.BadParameter(
            f"{results.name} predates ranked_ids — re-run `backcat-eval run` to record them"
        )
    golden = {q["id"]: q for q in json.loads(golden_set.read_text(encoding="utf-8"))}
    with connect() as conn:
        n = build_pool(conn, data, golden, k=k)
        conn.commit()
    typer.echo(f"pooled {n} (question, chunk) pairs — judge them at /dashboard/eval")


@app.command()
def rescore(
    results: Path = typer.Option(DEFAULT_RESULTS, "--results"),
    k: int = typer.Option(5, "--k"),
    threshold: int = typer.Option(2, "--threshold", help="min label to count as relevant (0-2)"),
) -> None:
    """Rescore a finished run against human labels instead of the generated key."""
    from .human import agreement, judged_questions, load_judgments
    from .human import rescore as rescore_results
    from .runner import CONFIGS, summarize

    data = json.loads(results.read_text(encoding="utf-8"))
    with connect() as conn:
        truth = load_judgments(conn, threshold=threshold)
        scorable = judged_questions(conn)
        overlap = agreement(conn)

    scored = rescore_results(data, truth, scorable, k=k)
    if not scored:
        typer.echo("no judged questions yet — label some at /dashboard/eval first")
        raise typer.Exit(1)

    summary = summarize(scored)
    lines = ["| category | n | " + " | ".join(f"{c} hit@k / mrr / recall@k" for c in CONFIGS) + " |"]
    lines.append("|---" * (2 + len(CONFIGS)) + "|")
    for cat, row in summary.items():
        cells = [
            f"{row[cfg]['hit@k']:.2f} / {row[cfg]['mrr']:.2f} / {row[cfg]['recall@k']:.2f}"
            for cfg in CONFIGS
        ]
        lines.append(f"| {cat} | {row['n']} | " + " | ".join(cells) + " |")
    typer.echo("\n".join(lines))
    typer.echo(
        f"\nscored on {len(scored)}/{len(data)} questions that have human labels"
        f"\ngenerated key agreed with human: {overlap['agreed_relevant']}"
        f" · generated but judged irrelevant: {overlap['generated_but_not_relevant']}"
        f" · relevant but missing from the generated key: {overlap['relevant_but_missed']}"
    )
    out = results.with_name(results.stem + "_human.md")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    typer.echo(f"saved to {out}")


@app.command()
def report(results: Path = typer.Option(DEFAULT_RESULTS, "--results")) -> None:
    """Print (and save as .md) the per-category results table."""
    from .runner import CONFIGS, summarize

    data = json.loads(results.read_text(encoding="utf-8"))
    summary = summarize(data)

    lines = ["| category | n | " + " | ".join(f"{c} hit@k / mrr / recall@k" for c in CONFIGS) + " |"]
    lines.append("|---" * (2 + len(CONFIGS)) + "|")
    for cat, row in summary.items():
        cells = [
            f"{row[cfg]['hit@k']:.2f} / {row[cfg]['mrr']:.2f} / {row[cfg]['recall@k']:.2f}"
            for cfg in CONFIGS
        ]
        lines.append(f"| {cat} | {row['n']} | " + " | ".join(cells) + " |")
    table = "\n".join(lines)
    typer.echo(table)
    md_path = results.with_suffix(".md")
    md_path.write_text(table + "\n", encoding="utf-8")
    typer.echo(f"\nsaved to {md_path}")
