import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ChartCardProps = {
  title: string;
  value?: string;
  delta?: {
    label: string;
    direction: "up" | "down" | "flat";
  };
  hint?: string;
  children: React.ReactNode;
};

export const ChartCard = ({ title, value, delta, hint, children }: ChartCardProps) => {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <div className="text-sm font-medium text-muted-foreground">{title}</div>
          {value ? (
            <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {value}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-1">
          {delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-sm font-medium tabular-nums",
                delta.direction === "up" && "text-emerald-600 dark:text-emerald-400",
                delta.direction === "down" && "text-rose-600 dark:text-rose-400",
                delta.direction === "flat" && "text-muted-foreground",
              )}
            >
              {delta.direction === "up" && <ArrowUpRight className="h-3.5 w-3.5" />}
              {delta.direction === "down" && <ArrowDownRight className="h-3.5 w-3.5" />}
              {delta.direction === "flat" && <Minus className="h-3.5 w-3.5" />}
              {delta.label}
            </span>
          ) : null}
          {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
};
