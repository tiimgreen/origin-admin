import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  delta?: {
    label: string;
    direction: "up" | "down" | "flat";
  };
  icon?: React.ComponentType<{ className?: string }>;
};

export const KpiCard = ({ label, value, hint, delta, icon: Icon }: KpiCardProps) => {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {Icon ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
            </div>
          ) : null}
        </div>

        <div className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                delta.direction === "up" && "text-emerald-600 dark:text-emerald-400",
                delta.direction === "down" && "text-rose-600 dark:text-rose-400",
                delta.direction === "flat" && "text-muted-foreground",
              )}
            >
              {delta.direction === "up" && <ArrowUpRight className="h-3 w-3" />}
              {delta.direction === "down" && <ArrowDownRight className="h-3 w-3" />}
              {delta.direction === "flat" && <Minus className="h-3 w-3" />}
              {delta.label}
            </span>
          ) : null}
          {hint ? <span>{hint}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
};
