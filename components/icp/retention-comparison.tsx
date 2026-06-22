import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";
import type { ComparisonDimension, RetentionICP } from "@/lib/data/icp-retention";

const TOP_BUCKETS_PER_DIMENSION = 6;

const formatDeltaPP = (value: number) => {
  const pp = Math.round(value * 1000) / 10;
  if (pp === 0) {
    return "0pp";
  }
  return `${pp > 0 ? "+" : ""}${pp.toFixed(1)}pp`;
};

const DeltaCell = ({ delta }: { delta: number }) => {
  const direction = delta > 0.005 ? "up" : delta < -0.005 ? "down" : "flat";
  const Icon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium tabular-nums",
        direction === "up" && "text-emerald-600 dark:text-emerald-400",
        direction === "down" && "text-rose-600 dark:text-rose-400",
        direction === "flat" && "text-muted-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      {formatDeltaPP(delta)}
    </span>
  );
};

type DimensionTableProps = {
  dimension: ComparisonDimension;
};

const DimensionTable = ({ dimension }: DimensionTableProps) => {
  const buckets = dimension.buckets.slice(0, TOP_BUCKETS_PER_DIMENSION);

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          {dimension.label}
        </h3>
        <p className="text-[11px] text-muted-foreground">{dimension.note}</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bucket</TableHead>
            <TableHead className="text-right">Retained</TableHead>
            <TableHead className="text-right">Churned</TableHead>
            <TableHead className="text-right">Δ retained – churned</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buckets.map((bucket) => {
            return (
              <TableRow key={`${dimension.key}-${bucket.label}`}>
                <TableCell className="text-xs font-medium capitalize">
                  {bucket.label}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {formatPercent(bucket.retainedPct)}
                  <span className="ml-1 text-muted-foreground">
                    ({bucket.retainedCount})
                  </span>
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                  {formatPercent(bucket.churnedPct)}
                  <span className="ml-1">({bucket.churnedCount})</span>
                </TableCell>
                <TableCell className="text-right text-xs">
                  <DeltaCell delta={bucket.delta} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

type RetentionComparisonProps = {
  icp: RetentionICP;
  retainedDefinition: string;
  churnedDefinition: string;
};

export const RetentionComparison = ({
  icp,
  retainedDefinition,
  churnedDefinition,
}: RetentionComparisonProps) => {
  const noData = icp.retainedCount === 0 || icp.churnedCount === 0;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Retained vs churned ICP
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Buckets over-represented in retained (positive Δ) are your real ICP signal.
              Top {TOP_BUCKETS_PER_DIMENSION} buckets per dimension by Δ.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success" className="gap-1">
              {formatNumber({ value: icp.retainedCount })} retained
            </Badge>
            <Badge variant="destructive" className="gap-1">
              {formatNumber({ value: icp.churnedCount })} churned
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">Retained:</span>{" "}
            {retainedDefinition}
          </span>
          <span>
            <span className="font-medium text-foreground">Churned:</span>{" "}
            {churnedDefinition}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {noData ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            Not enough data yet — need at least one shop in each cohort to compare.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {icp.dimensions.map((dimension) => {
              return (
                <DimensionTable key={dimension.key} dimension={dimension} />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
