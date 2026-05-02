type FormatCurrencyArgs = {
  amount: number;
  currency?: string;
  compact?: boolean;
};

export const formatCurrency = ({
  amount,
  currency = "USD",
  compact = false,
}: FormatCurrencyArgs) => {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  });

  return formatter.format(amount);
};

type FormatNumberArgs = {
  value: number;
  compact?: boolean;
  decimals?: number;
};

export const formatNumber = ({
  value,
  compact = false,
  decimals,
}: FormatNumberArgs) => {
  const formatter = new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: decimals ?? (compact ? 1 : 0),
  });

  return formatter.format(value);
};

export const formatPercent = (value: number, decimals = 1) => {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  });

  return formatter.format(value);
};

type FormatDeltaArgs = {
  current: number;
  previous: number;
};

export type DeltaDirection = "up" | "down" | "flat";

export type Delta = {
  value: number;
  label: string;
  direction: DeltaDirection;
};

export const formatDelta = ({ current, previous }: FormatDeltaArgs): Delta => {
  if (previous === 0) {
    return { value: 0, label: "—", direction: "flat" };
  }

  const ratio = (current - previous) / Math.abs(previous);
  const direction: DeltaDirection =
    ratio > 0 ? "up" : ratio < 0 ? "down" : "flat";

  return {
    value: ratio,
    label: formatPercent(Math.abs(ratio), 1),
    direction,
  };
};
