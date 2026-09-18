export const isoDate = (date: Date) => {
  return date.toISOString().slice(0, 10);
};

export const startOfDayUtc = (date: Date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const subtractDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
};

export const monthKey = (date: Date) => {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
};

export const formatMonthLabel = (key: string) => {
  const [year, month] = key.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

export const formatDayLabel = (key: string) => {
  const [year, month, day] = key.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

// A period key is either a month ("2026-09") or a day ("2026-09-15").
export const formatPeriodLabel = (key: string) => {
  return key.length === 7 ? formatMonthLabel(key) : formatDayLabel(key);
};
