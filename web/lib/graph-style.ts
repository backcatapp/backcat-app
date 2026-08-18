/** Brandbook equalizer colors — one per episode so concepts map to videos. */
export const EP_PALETTE = [
  "#ff8a3d",
  "#FF5E7E",
  "#FDBE33",
  "#5AC18E",
  "#3BAFDA",
  "#906EE4",
  "#E0568C",
  "#2AA9E0",
];

export const TYPE_COLORS: Record<string, string> = {
  Concept: "#e06a1f",
  Person: "#1f9a80",
  Resource: "#7a73e6",
};

export type GraphEpisode = {
  id: string;
  title: string;
  source_url?: string | null;
  duration_s?: number | null;
  published_at?: string | null;
  concepts?: number;
};

export function epColor(id: string | null | undefined): string {
  if (!id) return TYPE_COLORS.Concept;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return EP_PALETTE[h % EP_PALETTE.length];
}
