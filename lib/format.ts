type FormatCurrencyArgs = {
  amount: number;
  currency?: string;
  compact?: boolean;
  decimals?: number;
};

export const formatCurrency = ({
  amount,
  currency = "USD",
  compact = false,
  decimals,
}: FormatCurrencyArgs) => {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: decimals ?? (compact ? 1 : 2),
    minimumFractionDigits: decimals ?? (compact ? 0 : 2),
  });

  return formatter.format(amount);
};

export const titleCase = (value: string) => {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const DAY_MS = 86_400_000;
const MONTH_MS = DAY_MS * 30.4375;

const plural = (count: number, unit: string) => {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
};

type FormatDurationWordsArgs = {
  from: string;
  to?: string | null;
};

// "2 years, 3 months" / "5 months" / "12 days". Open-ended when `to` is null.
export const formatDurationWords = ({ from, to }: FormatDurationWordsArgs) => {
  const fromMs = new Date(from).getTime();
  const toMs = to ? new Date(to).getTime() : Date.now();
  const elapsedMs = Math.max(0, toMs - fromMs);

  const totalMonths = Math.floor(elapsedMs / MONTH_MS);
  if (totalMonths === 0) {
    return plural(Math.floor(elapsedMs / DAY_MS), "day");
  }

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  const parts: Array<string> = [];
  if (years > 0) {
    parts.push(plural(years, "year"));
  }
  if (months > 0) {
    parts.push(plural(months, "month"));
  }

  return parts.join(", ");
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

type ShopUserNameArgs = {
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export const shopUserDisplayName = (user: ShopUserNameArgs) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name.length > 0 ? name : user.email;
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
