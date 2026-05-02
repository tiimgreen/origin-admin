import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/format";
import type { ActivationFunnelStep } from "@/lib/data/icp";

type ActivationFunnelProps = {
  steps: Array<ActivationFunnelStep>;
};

export const ActivationFunnelCard = ({ steps }: ActivationFunnelProps) => {
  const top = steps[0]?.count ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          Activation funnel
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Each row shows where shops drop off · % from prior step in parentheses
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {steps.map((step, index) => {
          const widthPct = top > 0 ? (step.count / top) * 100 : 0;
          const color = `var(--color-chart-${(index % 5) + 1})`;

          return (
            <div key={step.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{step.label}</span>
                <div className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                  <span className="text-foreground">
                    {formatNumber({ value: step.count })}
                  </span>
                  <span>{formatPercent(step.conversionFromTop)}</span>
                  {index > 0 ? (
                    <span className="text-[10px]">
                      ({formatPercent(step.conversionFromPrev)} from prev)
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${widthPct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
