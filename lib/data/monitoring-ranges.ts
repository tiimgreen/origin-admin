// Kept free of server-only imports so client components can read the presets.

export type MonitoringRange = "1h" | "6h" | "24h" | "7d";

export type MonitoringBucket = "minute" | "hour";

type RangeSpec = {
  label: string;
  hours: number;
  bucket: MonitoringBucket;
};

export const MONITORING_RANGES: Record<MonitoringRange, RangeSpec> = {
  "1h": { label: "Last hour", hours: 1, bucket: "minute" },
  "6h": { label: "Last 6 hours", hours: 6, bucket: "minute" },
  "24h": { label: "Last 24 hours", hours: 24, bucket: "hour" },
  "7d": { label: "Last 7 days", hours: 168, bucket: "hour" },
};

export const DEFAULT_MONITORING_RANGE: MonitoringRange = "24h";

export const isMonitoringRange = (value: unknown): value is MonitoringRange => {
  return typeof value === "string" && value in MONITORING_RANGES;
};
