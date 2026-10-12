// Kept free of server-only imports so client components can read the presets.

export type ActivityRange = "30d" | "90d" | "180d" | "365d";

type RangeSpec = {
  label: string;
  days: number;
};

export const ACTIVITY_RANGES: Record<ActivityRange, RangeSpec> = {
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
  "180d": { label: "Last 180 days", days: 180 },
  "365d": { label: "Last 365 days", days: 365 },
};

export const DEFAULT_ACTIVITY_RANGE: ActivityRange = "90d";

export const isActivityRange = (value: unknown): value is ActivityRange => {
  return typeof value === "string" && value in ACTIVITY_RANGES;
};
