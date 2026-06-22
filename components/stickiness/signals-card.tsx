import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";
import type { StickinessSignal } from "@/lib/data/stickiness";

type SignalsCardProps = {
  signals: Array<StickinessSignal>;
};

const formatDeltaPP = (value: number) => {
  const pp = Math.round(value * 1000) / 10;
  return `${pp > 0 ? "+" : ""}${pp.toFixed(1)}pp`;
};

export const SignalsCard = ({ signals }: SignalsCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Key signals
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Buckets where sticky and churned merchants diverge most — the strongest
          patterns to target (or avoid). Δ is sticky share minus churned share.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {signals.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            Not enough data yet — need shops in both cohorts to surface patterns.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {signals.map((signal) => {
              const towardsSticky = signal.delta > 0;
              const Icon = towardsSticky ? ArrowUpRight : ArrowDownRight;

              return (
                <div
                  key={`${signal.dimensionKey}-${signal.bucketLabel}`}
                  className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 p-3"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {signal.dimensionLabel}
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium text-foreground">
                      {signal.bucketLabel}
                    </div>
                    <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                      sticky {formatPercent(signal.stickyPct)} · churned{" "}
                      {formatPercent(signal.churnedPct)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums",
                        towardsSticky
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {formatDeltaPP(signal.delta)}
                    </span>
                    <Badge
                      variant={towardsSticky ? "success" : "destructive"}
                      className="text-[10px]"
                    >
                      {towardsSticky ? "retains" : "churns"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
