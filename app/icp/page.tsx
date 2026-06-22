import { Suspense } from "react";
import Link from "next/link";
import { Award, Clock, PiggyBank, ShoppingCart, Users } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/layout/kpi-card";
import { PageHeader } from "@/components/layout/page-header";
import { RetentionComparison } from "@/components/icp/retention-comparison";
import {
  getRetentionICP,
  RETAINED_MIN_MONTHS,
  RETENTION_SESSION_MONTHS,
  TOP_RETAINED_COUNT,
  type RetentionMode,
} from "@/lib/data/icp-retention";
import { FX_AS_OF } from "@/lib/data/currencies";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const CHURNED_DEFINITION = "any shop that was paying then cancelled or uninstalled";

const MODE_OPTIONS: Array<{ key: RetentionMode; label: string; hint: string }> = [
  {
    key: "monthly",
    label: "Every month",
    hint: `≥1 session in each of the last ${RETENTION_SESSION_MONTHS} months`,
  },
  {
    key: "average",
    label: "Avg / month",
    hint: `avg ≥1 session/month over the last ${RETENTION_SESSION_MONTHS} months`,
  },
];

const isRetentionMode = (value: string | undefined): value is RetentionMode => {
  return value === "monthly" || value === "average";
};

const retainedDefinition = (mode: RetentionMode) => {
  const sessionRule = MODE_OPTIONS.find((o) => o.key === mode)?.hint ?? "";
  return `paying ≥ ${RETAINED_MIN_MONTHS} months, no contraction event, ${sessionRule}, still installed & paying`;
};

type ModeToggleProps = {
  current: RetentionMode;
};

const ModeToggle = ({ current }: ModeToggleProps) => {
  return (
    <div className="flex flex-wrap gap-1 rounded-md border bg-muted p-1">
      {MODE_OPTIONS.map((option) => {
        const isCurrent = option.key === current;
        const href =
          option.key === "monthly" ? "/icp" : `/icp?mode=${option.key}`;

        return (
          <Link
            key={option.key}
            href={href}
            className={cn(
              "rounded px-3 py-1.5 text-xs font-medium transition-colors",
              isCurrent
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
};

type IcpBoardProps = {
  mode: RetentionMode;
};

const IcpBoard = async ({ mode }: IcpBoardProps) => {
  const icp = await getRetentionICP({ mode });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Retained customers"
          value={formatNumber({ value: icp.retainedCount })}
          hint={`${RETAINED_MIN_MONTHS}mo+, no contraction`}
          icon={Award}
        />
        <KpiCard
          label="Churned (baseline)"
          value={formatNumber({ value: icp.churnedCount })}
          hint="cancelled or uninstalled"
          icon={Users}
        />
        <KpiCard
          label="Median MRR (retained)"
          value={formatCurrency({
            amount: icp.medianRetainedMrr,
            compact: true,
          })}
          hint="current subscription price"
          icon={PiggyBank}
        />
        <KpiCard
          label="Median tenure (retained)"
          value={`${formatNumber({ value: icp.medianRetainedTenureMonths, decimals: 0 })}mo`}
          hint="since first paid"
          icon={Clock}
        />
        <KpiCard
          label="Orders at install"
          value={`${formatNumber({ value: icp.medianRetainedOrdersAtInstall, compact: true })} vs ${formatNumber({ value: icp.medianChurnedOrdersAtInstall, compact: true })}`}
          hint="median retained vs churned"
          icon={ShoppingCart}
        />
      </div>

      <RetentionComparison
        icp={icp}
        retainedDefinition={retainedDefinition(mode)}
        churnedDefinition={CHURNED_DEFINITION}
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Top {TOP_RETAINED_COUNT} retained customers
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {RETAINED_MIN_MONTHS}mo+ tenure, no contraction · ranked by MRR · annual revenue is annualised tracked GMV (×4)
            </p>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {icp.retainedCount} qualify
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead>Vertical</TableHead>
                <TableHead>Shopify plan</TableHead>
                <TableHead>Referral</TableHead>
                <TableHead className="text-right">Orders @ install</TableHead>
                <TableHead className="text-right">Annual rev (est.)</TableHead>
                <TableHead className="text-right">Tenure</TableHead>
                <TableHead className="text-right">MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {icp.topRetained.map((shop) => {
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
                    <TableCell className="text-xs capitalize">
                      {shop.vertical ? (
                        shop.vertical.replace(/[_-]+/g, " ").toLowerCase()
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {shop.shopifyPlus ? (
                          <Badge variant="success" className="text-[10px]">
                            Plus
                          </Badge>
                        ) : null}
                        {shop.isPartnerDev ? (
                          <Badge variant="warning" className="text-[10px]">
                            Dev
                          </Badge>
                        ) : null}
                        {!shop.shopifyPlus && !shop.isPartnerDev ? (
                          <span className="text-xs">
                            {shop.shopifyPlan ?? "—"}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs capitalize">
                      {shop.referralChannel}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {shop.orderCountAtInstall === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatNumber({
                          value: shop.orderCountAtInstall,
                          compact: true,
                        })
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {shop.annualizedGmv > 0 ? (
                        formatCurrency({
                          amount: shop.annualizedGmv,
                          compact: true,
                        })
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatNumber({
                        value: shop.tenureMonths,
                        decimals: 0,
                      })}
                      mo
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatCurrency({ amount: shop.mrr, compact: true })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
};

const IcpSkeleton = () => {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => {
          return (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </>
  );
};

type IcpPageProps = {
  searchParams: Promise<{ mode?: string }>;
};

export default async function IcpPage({ searchParams }: IcpPageProps) {
  const params = await searchParams;
  const mode: RetentionMode = isRetentionMode(params.mode)
    ? params.mode
    : "monthly";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retained ICP"
        description={`What your retained customers (${RETAINED_MIN_MONTHS}mo+, no contraction, consistently active) have in common that churned customers don't.`}
        actions={<ModeToggle current={mode} />}
      />

      <Suspense key={mode} fallback={<IcpSkeleton />}>
        <IcpBoard mode={mode} />
      </Suspense>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Merchant size is compared using <code className="text-[10px]">order_count_at_install</code>, which is
        captured at install and survives uninstall. Live GMV is deleted when a shop uninstalls, so it can&apos;t be
        compared across cohorts — it&apos;s shown (annualised ×4) only for the currently-installed retained shops, in USD
        at fixed rates ({FX_AS_OF}). Team size and true merchant annual revenue are not stored anywhere and are omitted.
        The &ldquo;consistently active&rdquo; requirement counts sessions from{" "}
        <code className="text-[10px]">shop_user_sessions</code>; toggle how it&apos;s applied with the control above.
      </p>
    </div>
  );
}
