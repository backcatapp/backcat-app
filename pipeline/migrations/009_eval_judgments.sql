-- 009_eval_judgments: human-in-the-loop relevance judgments.
--
-- The generated golden set defines ground truth with the same Neo4j MENTIONED_IN
-- traversal the graph retrieval channel searches through: aggregation/temporal
-- questions take relevant_chunk_ids from entity_mention_chunks(), multi_hop from
-- cooccurring_pairs(). 48 of 88 questions therefore score the graph against its own
-- index. A human reading chunk text against the question has no such channel — these
-- tables hold that judgment so the harness can be scored on it instead.

CREATE TABLE IF NOT EXISTS eval_questions (
    id TEXT PRIMARY KEY,
    catalog_id TEXT NOT NULL REFERENCES catalogs(id),
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    -- The old, contaminated key: kept so the human labels can be diffed against it
    -- rather than silently replacing it.
    generated_chunk_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eval_questions_catalog_idx ON eval_questions (catalog_id, category);

-- TREC-style pool: every chunk any configuration surfaced for a question. Judging
-- the pool rather than the whole catalog is what makes hand-labelling tractable;
-- priority 1 is the union of the configs' top-5, which is all hit@5 and MRR can see.
CREATE TABLE IF NOT EXISTS eval_pool (
    question_id TEXT NOT NULL REFERENCES eval_questions(id) ON DELETE CASCADE,
    chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    catalog_id TEXT NOT NULL REFERENCES catalogs(id),
    channels TEXT[] NOT NULL DEFAULT '{}',
    best_rank INT NOT NULL DEFAULT 999,
    priority SMALLINT NOT NULL DEFAULT 2,
    PRIMARY KEY (question_id, chunk_id)
);
CREATE INDEX IF NOT EXISTS eval_pool_queue_idx ON eval_pool (question_id, priority, best_rank);

-- label: 0 = not relevant, 1 = related but doesn't answer, 2 = answers the question.
-- Graded so binary metrics can pick a threshold and nDCG stays possible later.
CREATE TABLE IF NOT EXISTS eval_judgments (
    question_id TEXT NOT NULL REFERENCES eval_questions(id) ON DELETE CASCADE,
    chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
    catalog_id TEXT NOT NULL REFERENCES catalogs(id),
    label SMALLINT NOT NULL CHECK (label >= 0 AND label <= 2),
    judged_by TEXT NOT NULL,
    judged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (question_id, chunk_id)
);
CREATE INDEX IF NOT EXISTS eval_judgments_question_idx ON eval_judgments (question_id, label);
