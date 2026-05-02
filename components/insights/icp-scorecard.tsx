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
import type { ICPScorecard, ScorecardDimension } from "@/lib/data/icp";

type ICPScorecardProps = {
  scorecard: ICPScorecard;
  championDefinition: string;
  churnerDefinition: string;
};

const TOP_BUCKETS_PER_DIMENSION = 3;

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

const groupDimensions = (dimensions: Array<ScorecardDimension>) => {
  const groups = new Map<string, Array<ScorecardDimension>>();
  for (const dim of dimensions) {
    const arr = groups.get(dim.group) ?? [];
    arr.push(dim);
    groups.set(dim.group, arr);
  }
  return Array.from(groups.entries());
};

export const ICPScorecardCard = ({
  scorecard,
  championDefinition,
  churnerDefinition,
}: ICPScorecardProps) => {
  const groups = groupDimensions(scorecard.dimensions);
  const noData = scorecard.championCount === 0 || scorecard.earlyChurnerCount === 0;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              ICP scorecard
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Dimensions where champions diverge most from early churners are your ICP signal.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              {formatNumber({ value: scorecard.baselineCount })} all shops
            </Badge>
            <Badge variant="success" className="gap-1">
              {formatNumber({ value: scorecard.championCount })} champions
            </Badge>
            <Badge variant="destructive" className="gap-1">
              {formatNumber({ value: scorecard.earlyChurnerCount })} early churners
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">Champions:</span>{" "}
            {championDefinition}
          </span>
          <span>
            <span className="font-medium text-foreground">Early churners:</span>{" "}
            {churnerDefinition}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {noData ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            Not enough data yet — need at least one shop in each cohort to compare.
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map(([group, dims]) => {
              return (
                <div key={group} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dimension</TableHead>
                        <TableHead>Bucket</TableHead>
                        <TableHead className="text-right">All shops</TableHead>
                        <TableHead className="text-right">Champions</TableHead>
                        <TableHead className="text-right">Churners</TableHead>
                        <TableHead className="text-right">Δ champ – churn</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dims.map((dim) => {
                        const top = dim.buckets.slice(0, TOP_BUCKETS_PER_DIMENSION);
                        return top.map((bucket, index) => {
                          return (
                            <TableRow key={`${dim.key}-${bucket.label}`}>
                              <TableCell className="text-xs font-medium">
                                {index === 0 ? dim.label : ""}
                              </TableCell>
                              <TableCell className="text-xs">
                                {bucket.label}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                                {formatPercent(bucket.allPct)}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                {formatPercent(bucket.championPct)}
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums">
                                {formatPercent(bucket.churnerPct)}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                <DeltaCell delta={bucket.delta} />
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
