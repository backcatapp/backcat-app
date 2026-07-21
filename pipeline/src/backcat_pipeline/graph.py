"""Neo4j graph layer (day 8 schema): Concept/Person/Resource + Episode/Chunk.

Every extraction edge carries provenance (episode_id, start_s) — principle #3.
Writes are idempotent: MERGE everywhere, and re-extraction of an episode
deletes that episode's MENTIONED_IN edges before rewriting (deterministic
replace, mirroring the Postgres upsert discipline).

Entity uid = "{catalog_id}:{normalized name}" because Neo4j Community only
supports single-property uniqueness constraints.
"""

from neo4j import GraphDatabase

from .config import settings

_LABELS = {"concept": "Concept", "person": "Person", "resource": "Resource"}
_ENTITY = "n:Concept OR n:Person OR n:Resource"

_driver = None


def get_driver():
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(
            settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
        )
    return _driver


def ensure_constraints() -> None:
    with get_driver().session() as s:
        for label in ("Concept", "Person", "Resource", "Category", "Episode", "Chunk", "Catalog"):
            key = "uid" if label in ("Concept", "Person", "Resource", "Category") else "id"
            s.run(
                f"CREATE CONSTRAINT IF NOT EXISTS FOR (n:{label}) REQUIRE n.{key} IS UNIQUE"
            )


def norm_key(name: str) -> str:
    return " ".join(name.split()).lower()


def sync_episode(conn, *, catalog_id: str, episode_id: str) -> None:
    """Mirror catalog/episode/chunk rows into the graph (MERGE, idempotent)."""
    cat = conn.execute("SELECT name FROM catalogs WHERE id = %s", (catalog_id,)).fetchone()
    ep = conn.execute(
        "SELECT title, source_url FROM episodes WHERE id = %s", (episode_id,)
    ).fetchone()
    chunks = conn.execute(
        "SELECT id, start_s, end_s FROM chunks WHERE episode_id = %s", (episode_id,)
    ).fetchall()
    with get_driver().session() as s:
        s.run(
            """
            MERGE (c:Catalog {id: $cid}) SET c.name = $cname
            MERGE (e:Episode {id: $eid})
            SET e.title = $title, e.source_url = $url, e.catalog_id = $cid
            MERGE (e)-[:IN_CATALOG]->(c)
            """,
            cid=catalog_id, cname=cat[0], eid=episode_id, title=ep[0], url=ep[1],
        )
        s.run(
            """
            UNWIND $chunks AS row
            MATCH (e:Episode {id: $eid})
            MERGE (ch:Chunk {id: row.id})
            SET ch.start_s = row.start_s, ch.end_s = row.end_s,
                ch.episode_id = $eid, ch.catalog_id = $cid
            MERGE (ch)-[:PART_OF]->(e)
            """,
            chunks=[{"id": c[0], "start_s": float(c[1]), "end_s": float(c[2])} for c in chunks],
            eid=episode_id, cid=catalog_id,
        )


def write_extraction(
    *, catalog_id: str, episode_id: str, mentions: dict[tuple[str, str], set[str]],
    chunk_starts: dict[str, float],
) -> int:
    """mentions: {(name, type): {chunk_id, ...}}. Replaces the episode's edges."""
    rows = []
    for (name, etype), chunk_ids in mentions.items():
        label = _LABELS.get(etype, "Concept")
        uid = f"{catalog_id}:{norm_key(name)}"
        for chunk_id in chunk_ids:
            rows.append(
                {"uid": uid, "name": name, "label": label, "chunk_id": chunk_id,
                 "start_s": chunk_starts.get(chunk_id, 0.0)}
            )
    with get_driver().session() as s:
        s.run(
            f"""
            MATCH (n)-[r:MENTIONED_IN]->(:Chunk {{episode_id: $eid}})
            WHERE {_ENTITY}
            DELETE r
            """,
            eid=episode_id,
        )
        for label in set(_LABELS.values()):
            batch = [r for r in rows if r["label"] == label]
            if not batch:
                continue
            s.run(
                f"""
                UNWIND $rows AS row
                MERGE (n:{label} {{uid: row.uid}})
                SET n.name = row.name, n.catalog_id = $cid
                WITH n, row
                MATCH (ch:Chunk {{id: row.chunk_id}})
                MERGE (n)-[:MENTIONED_IN {{episode_id: $eid, start_s: row.start_s}}]->(ch)
                """,
                rows=batch, cid=catalog_id, eid=episode_id,
            )
        # prune entities left with no mentions (after re-extraction)
        s.run(f"MATCH (n) WHERE ({_ENTITY}) AND NOT (n)--() DELETE n")
    return len(mentions)


def write_categories(
    *, catalog_id: str, episode_id: str, categories: dict[str, list[str]]
) -> None:
    """categories: {category_name: [child entity names]}. Two-level hierarchy:
    (Episode)-[:ABOUT]->(Category)-[:INCLUDES {episode_id}]->(entity).
    Idempotent: this episode's ABOUT/INCLUDES edges are replaced."""
    with get_driver().session() as s:
        s.run(
            "MATCH (:Episode {id: $eid})-[r:ABOUT]->(:Category) DELETE r", eid=episode_id
        )
        s.run(
            "MATCH (:Category)-[r:INCLUDES {episode_id: $eid}]->() DELETE r", eid=episode_id
        )
        for name, children in categories.items():
            if not name.strip():
                continue
            uid = f"{catalog_id}:cat:{norm_key(name)}"
            s.run(
                """
                MERGE (c:Category {uid: $uid})
                SET c.name = $name, c.catalog_id = $cid
                WITH c
                MATCH (ep:Episode {id: $eid})
                MERGE (ep)-[:ABOUT]->(c)
                """,
                uid=uid, name=name.strip(), cid=catalog_id, eid=episode_id,
            )
            child_uids = [f"{catalog_id}:{norm_key(ch)}" for ch in children if ch.strip()]
            s.run(
                """
                UNWIND $child_uids AS cu
                MATCH (c:Category {uid: $uid})
                MATCH (n {uid: cu})
                MERGE (c)-[:INCLUDES {episode_id: $eid}]->(n)
                """,
                child_uids=child_uids, uid=uid, eid=episode_id,
            )
        s.run("MATCH (c:Category) WHERE NOT ()-[:ABOUT]->(c) DETACH DELETE c")


def catalog_graph(catalog_id: str, limit: int = 120) -> dict:
    """Nodes (entities w/ mention counts) + links (chunk co-occurrence)."""
    with get_driver().session() as s:
        nodes = s.run(
            f"""
            MATCH (n)-[:MENTIONED_IN]->(ch:Chunk {{catalog_id: $cid}})
            WHERE {_ENTITY}
            WITH n, count(DISTINCT ch) AS mentions,
                 count(DISTINCT ch.episode_id) AS episodes
            ORDER BY mentions DESC LIMIT $limit
            RETURN n.uid AS id, n.name AS name, labels(n)[0] AS label,
                   mentions, episodes
            """,
            cid=catalog_id, limit=limit,
        ).data()
        ids = [n["id"] for n in nodes]
        links = s.run(
            f"""
            MATCH (a)-[:MENTIONED_IN]->(ch:Chunk {{catalog_id: $cid}})<-[:MENTIONED_IN]-(b)
            WHERE a.uid IN $ids AND b.uid IN $ids AND a.uid < b.uid
            RETURN a.uid AS source, b.uid AS target, count(DISTINCT ch) AS weight
            ORDER BY weight DESC LIMIT 500
            """,
            cid=catalog_id, ids=ids,
        ).data()
        # top-level categories as hub nodes with INCLUDES links to children
        cats = s.run(
            """
            MATCH (c:Category {catalog_id: $cid})-[:INCLUDES]->(n)
            WHERE n.uid IN $ids
            WITH c, collect(DISTINCT n.uid) AS children
            RETURN c.uid AS id, c.name AS name, 'Category' AS label,
                   size(children) AS mentions, 0 AS episodes, children
            """,
            cid=catalog_id, ids=ids,
        ).data()
        for c in cats:
            children = c.pop("children")
            nodes.append(c)
            for ch in children:
                links.append({"source": c["id"], "target": ch, "weight": 1, "kind": "includes"})
    return {"nodes": nodes, "links": links}


def concept_chunks(uid: str, limit: int = 30) -> list[dict]:
    """Moments for a selected node. Categories traverse INCLUDES one hop."""
    with get_driver().session() as s:
        return s.run(
            """
            MATCH (n {uid: $uid})
            OPTIONAL MATCH (n)-[:MENTIONED_IN]->(direct:Chunk)
            OPTIONAL MATCH (n)-[:INCLUDES]->()-[:MENTIONED_IN]->(child:Chunk)
            WITH collect(DISTINCT direct) + collect(DISTINCT child) AS chs
            UNWIND chs AS ch
            WITH DISTINCT ch WHERE ch IS NOT NULL
            RETURN ch.id AS chunk_id, ch.episode_id AS episode_id,
                   ch.start_s AS start_s, ch.end_s AS end_s
            ORDER BY ch.episode_id, ch.start_s LIMIT $limit
            """,
            uid=uid, limit=limit,
        ).data()


def episode_topics(episode_id: str) -> dict:
    """Two-level topics: categories (episode 'about' words) -> detailed topics
    with mention windows. Entities without a category land in 'uncategorized'."""
    with get_driver().session() as s:
        topics = s.run(
            f"""
            MATCH (n)-[:MENTIONED_IN]->(ch:Chunk {{episode_id: $eid}})
            WHERE {_ENTITY}
            OPTIONAL MATCH (cat:Category)-[:INCLUDES {{episode_id: $eid}}]->(n)
            WITH n, cat, collect({{start_s: ch.start_s, end_s: ch.end_s}}) AS windows,
                 count(ch) AS mentions
            ORDER BY mentions DESC
            RETURN coalesce(cat.name, '') AS category, n.name AS name,
                   labels(n)[0] AS label, mentions, windows
            """,
            eid=episode_id,
        ).data()
        cat_order = [
            r["name"]
            for r in s.run(
                "MATCH (:Episode {id: $eid})-[:ABOUT]->(c:Category) RETURN c.name AS name",
                eid=episode_id,
            ).data()
        ]
    grouped: dict[str, list[dict]] = {}
    for t in topics:
        grouped.setdefault(t.pop("category"), []).append(t)
    categories = [
        {"name": c, "topics": grouped[c]} for c in cat_order if c in grouped
    ]
    if "" in grouped:
        categories.append({"name": "", "topics": grouped[""]})
    return {"categories": categories}


def _entity_matches(query: str, names: list[dict]) -> list[str]:
    """Token-overlap entity linking: an entity matches when the full name is in
    the query, or ≥ half its significant tokens appear in the query."""
    q = query.lower()
    q_tokens = {t for t in q.replace("؟", " ").replace("?", " ").split() if len(t) >= 3}
    matched = []
    for row in names:
        name = row["name"].lower()
        tokens = {t for t in name.split() if len(t) >= 3}
        if not tokens:
            continue
        if name in q:
            matched.append(row["uid"])
            continue
        overlap = len(tokens & q_tokens) / len(tokens)
        if overlap >= 0.5 and len(tokens & q_tokens) >= (1 if len(tokens) == 1 else 2):
            matched.append(row["uid"])
    return matched


def graph_search_chunks(catalog_id: str, query: str, k: int = 20) -> list[tuple[str, float]]:
    """Graph channel: entities linked from the query -> their chunks (score 2.0)
    plus chunks of co-occurring neighbor entities (score 1.0)."""
    with get_driver().session() as s:
        names = s.run(
            f"MATCH (n) WHERE ({_ENTITY}) AND n.catalog_id = $cid RETURN n.uid AS uid, n.name AS name",
            cid=catalog_id,
        ).data()
        matched = _entity_matches(query, names)
        if not matched:
            return []
        rows = s.run(
            f"""
            MATCH (m) WHERE ({{}} OR true) AND m.uid IN $uids
            OPTIONAL MATCH (m)-[:MENTIONED_IN]->(direct:Chunk)
            OPTIONAL MATCH (m)-[:MENTIONED_IN]->(:Chunk)<-[:MENTIONED_IN]-(nb)
                WHERE NOT nb.uid IN $uids
            OPTIONAL MATCH (nb)-[:MENTIONED_IN]->(near:Chunk)
            WITH collect(DISTINCT direct.id) AS d, collect(DISTINCT near.id) AS nr
            RETURN d, nr
            """.format(_ENTITY.replace("n:", "m:")),
            uids=matched,
        ).single()
    if rows is None:
        return []
    direct = [c for c in rows["d"] if c]
    near = [c for c in rows["nr"] if c and c not in set(direct)]
    scored = [(c, 2.0) for c in direct] + [(c, 1.0) for c in near]
    return scored[:k]
