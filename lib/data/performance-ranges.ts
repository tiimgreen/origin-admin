// Kept free of server-only imports so client components can read the presets.

export type PerformanceRange = "30d" | "12m" | "24m";

export type Granularity = "day" | "month";

type RangeSpec = {
  label: string;
  granularity: Granularity;
  count: number;
};

export const PERFORMANCE_RANGES: Record<PerformanceRange, RangeSpec> = {
  "30d": { label: "Last 30 days", granularity: "day", count: 30 },
  "12m": { label: "Last 12 months", granularity: "month", count: 12 },
  "24m": { label: "Last 24 months", granularity: "month", count: 24 },
};

export const DEFAULT_PERFORMANCE_RANGE: PerformanceRange = "24m";

export const isPerformanceRange = (value: unknown): value is PerformanceRange => {
  return typeof value === "string" && value in PERFORMANCE_RANGES;
};
