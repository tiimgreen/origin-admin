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
import { formatNumber, formatPercent } from "@/lib/format";
import type { PlanProgressionResult } from "@/lib/data/plan-progression";

type PlanProgressionCardProps = {
  result: PlanProgressionResult;
};

const matrixHeatColor = (ratio: number) => {
  if (ratio >= 0.5) {
    return "bg-emerald-500/30";
  }
  if (ratio >= 0.25) {
    return "bg-emerald-500/20";
  }
  if (ratio >= 0.1) {
    return "bg-emerald-500/10";
  }
  if (ratio > 0) {
    return "bg-emerald-500/5";
  }
  return "bg-transparent";
};

export const PlanProgressionCard = ({ result }: PlanProgressionCardProps) => {
  const endLabels = Array.from(
    new Set([
      ...result.planOrder,
      ...result.matrix.map((c) => c.endPlan),
      "churned",
    ]),
  );

  const matrixLookup = new Map(
    result.matrix.map((c) => [`${c.startPlan}|${c.endPlan}`, c.count]),
  );

  const totalUpgraded = result.timeToUpgrade.reduce((sum, b) => {
    return sum + b.count;
  }, 0);
  const upgradeMax = Math.max(1, ...result.timeToUpgrade.map((b) => b.count));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Start plan → end plan
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            First paid plan vs current plan · {formatNumber({ value: result.journeys.length })} shops with paid history
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Start \ End</TableHead>
                {endLabels.map((label) => {
                  return (
                    <TableHead
                      key={label}
                      className="text-right text-xs capitalize"
                    >
                      {label}
                    </TableHead>
                  );
                })}
                <TableHead className="text-right text-xs">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.planOrder.map((startPlan) => {
                const rowTotal = endLabels.reduce((sum, end) => {
                  return sum + (matrixLookup.get(`${startPlan}|${end}`) ?? 0);
                }, 0);

                if (rowTotal === 0) {
                  return null;
                }

                return (
                  <TableRow key={startPlan}>
                    <TableCell className="text-xs font-medium capitalize">
                      {startPlan}
                    </TableCell>
                    {endLabels.map((end) => {
                      const count = matrixLookup.get(`${startPlan}|${end}`) ?? 0;
                      const ratio = rowTotal > 0 ? count / rowTotal : 0;

                      return (
                        <TableCell
                          key={end}
                          className={`text-right text-xs tabular-nums ${matrixHeatColor(ratio)}`}
                        >
                          {count > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="font-medium">
                                {formatNumber({ value: count })}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatPercent(ratio, 0)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right text-xs font-semibold tabular-nums">
                      {formatNumber({ value: rowTotal })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Time to first upgrade
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Days from first paid sub to first plan upgrade · {formatNumber({ value: totalUpgraded })} shops
            </p>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {result.timeToUpgrade.map((bucket) => {
              const ratio = bucket.count / upgradeMax;

              return (
                <div key={bucket.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{bucket.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatNumber({ value: bucket.count })}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[var(--color-chart-1)]"
                      style={{ width: `${ratio * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Predictors by journey
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              What characteristics correlate with each outcome
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Journey</TableHead>
                  <TableHead className="text-right text-xs">Shops</TableHead>
                  <TableHead className="text-right text-xs">Plus</TableHead>
                  <TableHead className="text-right text-xs">Ad acct</TableHead>
                  <TableHead className="text-right text-xs">Orders @install</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.predictors.map((row) => {
                  return (
                    <TableRow key={row.label}>
                      <TableCell className="text-xs font-medium">
                        {row.label}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatNumber({ value: row.count })}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {row.count > 0 ? (
                          <Badge
                            variant={row.shopifyPlusRate > 0.05 ? "success" : "outline"}
                            className="font-mono text-[10px]"
                          >
                            {formatPercent(row.shopifyPlusRate, 0)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {row.count > 0
                          ? formatPercent(row.adAccountRate, 0)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {row.count > 0 && row.ordersAtInstallMedian > 0
                          ? formatNumber({
                              value: row.ordersAtInstallMedian,
                              compact: true,
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
