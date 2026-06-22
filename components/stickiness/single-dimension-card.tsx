import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CohortCompareChart } from "@/components/charts/cohort-compare-chart";
import { formatNumber } from "@/lib/format";
import type { SingleDimensionReport } from "@/lib/data/stickiness";

type SingleDimensionCardProps = {
  report: SingleDimensionReport;
};

export const SingleDimensionCard = ({ report }: SingleDimensionCardProps) => {
  const noData = report.stickyCount === 0 || report.churnedCount === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          {report.label}
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">{report.description}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge variant="success" className="gap-1">
            {formatNumber({ value: report.stickyCount })} sticky
          </Badge>
          <Badge variant="destructive" className="gap-1">
            {formatNumber({ value: report.churnedCount })} churned
          </Badge>
        </div>
        {noData ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            Not enough data yet — need shops in both cohorts for this segment.
          </p>
        ) : (
          <CohortCompareChart data={report.buckets} />
        )}
      </CardContent>
    </Card>
  );
};
