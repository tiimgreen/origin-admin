"use client";

import { useState } from "react";
import { ChevronDown, TrendingDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { HealthMatrix, HealthQuadrant } from "@/lib/data/health";

type HealthMatrixCardProps = {
  matrix: HealthMatrix;
};

const QUADRANT_STYLES: Record<string, string> = {
  "paid-high":
    "border-emerald-500/40 bg-emerald-500/5 dark:border-emerald-500/30 dark:bg-emerald-500/10",
  "free-high":
    "border-sky-500/40 bg-sky-500/5 dark:border-sky-500/30 dark:bg-sky-500/10",
  "paid-low":
    "border-amber-500/40 bg-amber-500/5 dark:border-amber-500/30 dark:bg-amber-500/10",
  "free-low":
    "border-muted-foreground/20 bg-muted/30",
};

export const HealthMatrixCard = ({ matrix }: HealthMatrixCardProps) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selectedQuadrant = selectedKey
    ? matrix.quadrants.find((q) => q.key === selectedKey) ?? null
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          Customer health matrix
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Plan tier × engagement · &ldquo;high&rdquo; engagement = ≥1 app session in last 30d · {formatNumber({ value: matrix.totalShops })} installed shops · click a section to see shops
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {matrix.quadrants.map((q) => {
            const share =
              matrix.totalShops > 0 ? q.shops / matrix.totalShops : 0;
            const isSelected = q.key === selectedKey;

            return (
              <button
                key={q.key}
                type="button"
                onClick={() => {
                  setSelectedKey(isSelected ? null : q.key);
                }}
                className={cn(
                  "rounded-lg border p-4 text-left transition-shadow hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  QUADRANT_STYLES[q.key] ?? "border-border bg-card",
                  isSelected && "ring-2 ring-ring",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {q.title}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {q.subtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {q.planTier} · {q.engagementTier}
                    </Badge>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground transition-transform",
                        isSelected && "rotate-180",
                      )}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-semibold tabular-nums">
                      {formatNumber({ value: q.shops })}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatPercent(share)} of installed
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground tabular-nums">
                        {formatCurrency({
                          amount: q.totalRevenue90d,
                          compact: true,
                        })}
                      </span>{" "}
                      90d GMV
                    </div>
                    <div>
                      median{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatCurrency({
                          amount: q.medianMonthlyRevenue,
                          compact: true,
                        })}
                      </span>
                      /mo
                    </div>
                  </div>
                </div>

                {q.trendingDown > 0 ? (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                    <TrendingDown className="h-3 w-3" />
                    <span>
                      {formatNumber({ value: q.trendingDown })} trending down (≥50% drop vs prior 30d)
                    </span>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        {selectedQuadrant ? (
          <QuadrantShopList quadrant={selectedQuadrant} />
        ) : null}
      </CardContent>
    </Card>
  );
};

type QuadrantShopListProps = {
  quadrant: HealthQuadrant;
};

const QuadrantShopList = ({ quadrant }: QuadrantShopListProps) => {
  const truncated = quadrant.shops > quadrant.shopList.length;

  return (
    <div className="mt-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="text-sm font-semibold text-foreground">
          {quadrant.title}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {truncated ? (
            <>
              showing top {formatNumber({ value: quadrant.shopList.length })} of{" "}
              {formatNumber({ value: quadrant.shops })} · sorted by 30d GMV
            </>
          ) : (
            <>
              {formatNumber({ value: quadrant.shops })} shops · sorted by 30d GMV
            </>
          )}
        </div>
      </div>

      {quadrant.shopList.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No shops in this section.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shop</TableHead>
              <TableHead>Installed</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Sessions (30d)</TableHead>
              <TableHead className="text-right">30d GMV</TableHead>
              <TableHead className="text-right">30d Orders</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quadrant.shopList.map((shop) => {
              return (
                <TableRow key={shop.shop}>
                  <TableCell>
                    {shop.name ? (
                      <div className="flex flex-col leading-tight">
                        <span className="text-xs font-medium">{shop.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {shop.shop}
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono text-xs">{shop.shop}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {shop.installedAt ? (
                      <div className="flex flex-col leading-tight">
                        <span className="text-xs tabular-nums">
                          {formatInstallDate(shop.installedAt)}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {formatInstallDuration(shop.installedAt)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs capitalize">
                      {shop.plan ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {shop.subscriptionPrice !== null && shop.subscriptionPrice > 0
                      ? `${PRICE_FORMATTER.format(shop.subscriptionPrice)}/mo`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber({ value: shop.sessions30d })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency({ amount: shop.revenue30d, compact: true })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber({ value: shop.orders30d })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

const PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatInstallDate = (iso: string) => {
  return DATE_FORMATTER.format(new Date(iso));
};

const formatInstallDuration = (iso: string) => {
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86_400_000,
  );

  if (days < 1) {
    return "today";
  }
  if (days < 30) {
    return `${days}d`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months}mo`;
  }
  const years = Math.floor(days / 365);
  const remainderMonths = Math.floor((days - years * 365) / 30);
  if (remainderMonths === 0) {
    return `${years}y`;
  }
  return `${years}y ${remainderMonths}mo`;
};
