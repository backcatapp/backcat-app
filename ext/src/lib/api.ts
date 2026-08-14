import { SERVE_URL } from "./ask";
import { getAccessToken } from "./auth";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  extra_credits: number;
  byok_configured: boolean;
  byok_last4: string | null;
  daily_cap: number;
  asks_today: number;
  free_left: number;
};

export type CatalogRow = {
  id: string;
  name: string;
  kinds: string[];
  episodes: number;
  chunks: number;
  indexed: boolean;
};

export type EpisodeRow = {
  id: string;
  title: string;
  source_url: string | null;
  published_at: string | null;
  youtube_id: string | null;
  indexed: boolean;
  indexing?: boolean;
};

export type VideoLookup = {
  catalog_id: string;
  episode_id: string;
  catalog_name: string;
  episode_title: string;
  indexed: boolean;
  indexing?: boolean;
  saved?: boolean;
  owned?: boolean;
  linked?: boolean;
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) throw new Error("not signed in");
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

export async function fetchProfile(): Promise<Profile> {
  const resp = await fetch(`${SERVE_URL}/api/me`, { headers: await authHeaders() });
  if (!resp.ok) throw new Error(`profile ${resp.status}`);
  return resp.json();
}

export async function updateDisplayName(display_name: string): Promise<Profile> {
  const resp = await fetch(`${SERVE_URL}/api/me`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify({ display_name }),
  });
  if (!resp.ok) throw new Error(`update ${resp.status}`);
  return resp.json();
}

export async function saveByok(api_key: string): Promise<{ byok_last4: string }> {
  const resp = await fetch(`${SERVE_URL}/api/me/byok`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify({ api_key }),
  });
  if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).detail || `byok ${resp.status}`);
  return resp.json();
}

export async function clearByok(): Promise<void> {
  const resp = await fetch(`${SERVE_URL}/api/me/byok`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error(`clear byok ${resp.status}`);
}

export async function fetchCatalogs(): Promise<CatalogRow[]> {
  const resp = await fetch(`${SERVE_URL}/api/me/catalogs`, { headers: await authHeaders() });
  if (!resp.ok) throw new Error(`catalogs ${resp.status}`);
  const data = await resp.json();
  return data.catalogs;
}

export async function addChannel(url: string): Promise<{ catalog_id: string; name: string; episodes: number }> {
  const resp = await fetch(`${SERVE_URL}/api/me/catalogs`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ url }),
  });
  if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).detail || `add ${resp.status}`);
  return resp.json();
}

export async function fetchCatalogEpisodes(catalogId: string): Promise<EpisodeRow[]> {
  const resp = await fetch(`${SERVE_URL}/api/me/catalogs/${catalogId}/episodes`, {
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error(`episodes ${resp.status}`);
  const data = await resp.json();
  return data.episodes;
}

export async function indexEpisode(
  episodeId: string
): Promise<{ episode_id: string; status: string; queued_new: number }> {
  const resp = await fetch(`${SERVE_URL}/api/me/episodes/${episodeId}/index`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!resp.ok) {
    const detail = (await resp.json().catch(() => ({}))).detail;
    throw new Error(detail || `index ${resp.status}`);
  }
  return resp.json();
}

export async function saveCatalog(catalogId: string): Promise<void> {
  const resp = await fetch(`${SERVE_URL}/api/me/catalogs/${catalogId}/save`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error(`save ${resp.status}`);
}

export async function unsaveCatalog(catalogId: string): Promise<void> {
  const resp = await fetch(`${SERVE_URL}/api/me/catalogs/${catalogId}/save`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error(`unsave ${resp.status}`);
}

export async function lookupVideo(
  youtubeId: string,
  opts?: { token?: string | null }
): Promise<VideoLookup | null> {
  const headers: Record<string, string> = {};
  if (opts?.token) headers.authorization = `Bearer ${opts.token}`;
  const resp = await fetch(`${SERVE_URL}/api/videos/${encodeURIComponent(youtubeId)}`, {
    headers,
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`lookup ${resp.status}`);
  return resp.json();
}

export type GraphNode = {
  id: string;
  name: string;
  label: string;
  mentions: number;
  episodes: number;
};

export type GraphData = {
  nodes: GraphNode[];
  links: { source: string; target: string; weight: number; kind?: string }[];
  episode_id?: string | null;
};

export type Moment = {
  episode: string;
  source_url?: string | null;
  start_s: number;
  end_s: number;
  text: string;
};

export async function fetchCatalogGraph(
  catalogId: string,
  opts?: { limit?: number; episodeId?: string | null }
): Promise<GraphData> {
  const limit = opts?.limit ?? 80;
  const qs = new URLSearchParams({ limit: String(limit) });
  if (opts?.episodeId) qs.set("episode_id", opts.episodeId);
  const resp = await fetch(
    `${SERVE_URL}/api/catalogs/${catalogId}/graph?${qs}`,
    { headers: await authHeaders() }
  );
  if (!resp.ok) throw new Error(`graph ${resp.status}`);
  return resp.json();
}

export async function fetchConceptMoments(
  uid: string,
  episodeId?: string | null
): Promise<Moment[]> {
  const qs = new URLSearchParams({ uid });
  if (episodeId) qs.set("episode_id", episodeId);
  const resp = await fetch(`${SERVE_URL}/api/concepts/chunks?${qs}`, {
    headers: await authHeaders(),
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.moments || [];
}
