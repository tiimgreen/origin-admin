/**
 * Hard-coded mid-market FX rates to USD as of May 2026.
 * Rough estimates for admin reporting only — not for billing.
 * Anything not in this table falls back to 1.0 (treated as USD).
 */
export const FX_TO_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 1.24,
  GBP: 1.39,
  CAD: 0.79,
  AUD: 0.72,
  NZD: 0.59,
  JPY: 0.0064,
  CHF: 1.07,
  SEK: 0.11,
  NOK: 0.11,
  DKK: 0.16,
  PLN: 0.27,
  CZK: 0.046,
  HUF: 0.0028,
  RON: 0.21,
  BGN: 0.63,
  TRY: 0.024,
  ILS: 0.27,
  AED: 0.27,
  SAR: 0.27,
  ZAR: 0.054,
  INR: 0.011,
  SGD: 0.78,
  HKD: 0.13,
  TWD: 0.031,
  KRW: 0.00072,
  THB: 0.029,
  MYR: 0.22,
  PHP: 0.018,
  IDR: 0.000063,
  VND: 0.000041,
  CNY: 0.14,
  BRL: 0.18,
  MXN: 0.057,
  ARS: 0.0010,
  CLP: 0.0010,
  COP: 0.00024,
};

export const FX_AS_OF = "May 2026";

export const toUsd = (amount: number, currency: string | null | undefined) => {
  if (!currency) {
    return amount;
  }
  const rate = FX_TO_USD[currency] ?? 1.0;
  return amount * rate;
};

/**
 * Returns a ClickHouse `multiIf(...)` expression that resolves a currency-code
 * column to its USD rate. Use as `amount * ${fxToUsdSql("ccy")}` in a query.
 */
export const fxToUsdSql = (currencyColumn: string) => {
  const branches = Object.entries(FX_TO_USD)
    .map(([code, rate]) => {
      return `${currencyColumn} = '${code}', ${rate}`;
    })
    .join(",\n      ");

  return `multiIf(\n      ${branches},\n      1.0\n    )`;
};
