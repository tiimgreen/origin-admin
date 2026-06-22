import { Suspense } from "react";
import Link from "next/link";
import { Compass, Globe, Layers, PiggyBank, Target, Users, Zap } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { RevenueHistogram } from "@/components/charts/revenue-histogram";
import { CategoryBarChart } from "@/components/charts/category-bar-chart";
import { ChurnDistributionChart } from "@/components/charts/churn-distribution-chart";
import { ICPScorecardCard } from "@/components/insights/icp-scorecard";
import { ActivationFunnelCard } from "@/components/insights/activation-funnel";
import {
  computeAdConnectionMatrix,
  computeCurrencyBreakdown,
  computePlanBreakdown,
  computePlatformAdoption,
  computeRevenueHistogram,
  computeTenureBuckets,
  getShopProfiles,
  getShopRevenue90d,
  joinAllShopsWithRevenue,
  joinShopsWithRevenue,
} from "@/lib/data/insights";
import {
  ACTIVE_SESSION_WINDOW_DAYS,
  SUPER_ACTIVE_SESSION_THRESHOLD,
  getShopActivity,
  isActive,
  isSuperActive,
} from "@/lib/data/activity";
import {
  computeAcquisitionBreakdown,
  computeActivationFunnel,
  computeChurnDistribution,
  computeChurnTypeBreakdown,
  computeICPScorecard,
  type ChurnSplitBy,
} from "@/lib/data/icp";
import { FX_AS_OF } from "@/lib/data/currencies";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

const CHAMPION_DEFINITION = `tenure ≥ 90d, paying, revenue in last 90d, super-active (≥${SUPER_ACTIVE_SESSION_THRESHOLD} sessions in last ${ACTIVE_SESSION_WINDOW_DAYS}d, post-subscribe)`;
const CHURNER_DEFINITION = "uninstalled within 30d of install";

const CHURN_SPLIT_OPTIONS: Array<{ key: ChurnSplitBy; label: string }> = [
  { key: "none", label: "All" },
  { key: "install-source", label: "By source" },
  { key: "shopify-plus", label: "By Plus" },
];

const isChurnSplit = (value: string | undefined): value is ChurnSplitBy => {
  return CHURN_SPLIT_OPTIONS.some((opt) => opt.key === value);
};

export const dynamic = "force-dynamic";

type InsightsBoardProps = {
  churnSplit: ChurnSplitBy;
};

const InsightsBoard = async ({ churnSplit }: InsightsBoardProps) => {
  const [shops, revenue, activity] = await Promise.all([
    getShopProfiles(),
    getShopRevenue90d(),
    getShopActivity(),
  ]);

  const joined = joinShopsWithRevenue(shops, revenue, activity);
  const allWithRevenue = joinAllShopsWithRevenue(shops, revenue, activity);
  const histogram = computeRevenueHistogram(joined);
  const adMatrix = computeAdConnectionMatrix(joined);
  const planBreakdown = computePlanBreakdown(joined);
  const currencyBreakdown = computeCurrencyBreakdown(shops);
  const tenure = computeTenureBuckets(joined);
  const platformAdoption = computePlatformAdoption(joined);
  const scorecard = computeICPScorecard(allWithRevenue);
  const activationFunnel = computeActivationFunnel(joined);
  const churnDistribution = computeChurnDistribution({
    shops: allWithRevenue,
    splitBy: churnSplit,
  });
  const churnTypes = computeChurnTypeBreakdown(allWithRevenue);
  const acquisition = computeAcquisitionBreakdown(allWithRevenue, allWithRevenue);

  const totalActiveShops = joined.filter(isActive).length;
  const totalSuperActiveShops = joined.filter(isSuperActive).length;
  const subscribedShops = joined.filter((s) => s.firstPaidAt !== null).length;
  const totalRevenue90d = joined.reduce((sum, s) => sum + s.revenue90d, 0);
  const medianRevenue = (() => {
    const active = joined
      .filter((s) => s.monthlyAvgRevenue > 0)
      .map((s) => s.monthlyAvgRevenue)
      .sort((a, b) => a - b);
    if (active.length === 0) {
      return 0;
    }
    return active[Math.floor(active.length / 2)];
  })();
  const shopsWithAdConnection = joined.filter(
    (s) => s.connectedPlatformKeys.length > 0,
  ).length;
  const allInstalled = shops.filter((s) => s.isInstalled).length;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label={`Active shops (${ACTIVE_SESSION_WINDOW_DAYS}d)`}
          value={formatNumber({ value: totalActiveShops })}
          hint={
            subscribedShops > 0
              ? `${formatPercent(totalActiveShops / subscribedShops)} of subscribed · ≥1 session post-subscribe`
              : undefined
          }
          icon={Users}
        />
        <KpiCard
          label={`Super-active (${ACTIVE_SESSION_WINDOW_DAYS}d)`}
          value={formatNumber({ value: totalSuperActiveShops })}
          hint={
            subscribedShops > 0
              ? `${formatPercent(totalSuperActiveShops / subscribedShops)} of subscribed · ≥${SUPER_ACTIVE_SESSION_THRESHOLD} sessions`
              : undefined
          }
          icon={Zap}
        />
        <KpiCard
          label="Revenue tracked (90d)"
          value={formatCurrency({ amount: totalRevenue90d, compact: true })}
          hint={`USD-converted (${FX_AS_OF})`}
          icon={PiggyBank}
        />
        <KpiCard
          label="Median monthly GMV"
          value={formatCurrency({ amount: medianRevenue, compact: true })}
          hint="among shops with revenue"
          icon={Target}
        />
        <KpiCard
          label="Shops with ad account"
          value={formatNumber({ value: shopsWithAdConnection })}
          hint={
            joined.length > 0
              ? `${formatPercent(shopsWithAdConnection / joined.length)} of installed`
              : undefined
          }
          icon={Layers}
        />
      </div>

      <ICPScorecardCard
        scorecard={scorecard}
        championDefinition={CHAMPION_DEFINITION}
        churnerDefinition={CHURNER_DEFINITION}
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Shops by monthly GMV
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Last 90 days, normalised to monthly · all currencies converted to USD at fixed rates ({FX_AS_OF}) · overlay shows shops with ≥1 connected ad account
            </p>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {joined.length} installed shops
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <RevenueHistogram
            data={histogram.map((p) => {
              return {
                bucket: p.bucket,
                shops: p.shops,
                shopsWithAds: p.shopsWithAds,
              };
            })}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Ad-account adoption by revenue bucket
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Where do high-value shops connect their ad accounts?
            </p>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {adMatrix.map((row) => {
              return (
                <div key={row.bucket} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{row.bucket}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {row.withAds}/{row.shops} ·{" "}
                      <span
                        className={
                          row.adRate > 0.5
                            ? "text-emerald-600 dark:text-emerald-400"
                            : row.adRate > 0.25
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground"
                        }
                      >
                        {formatPercent(row.adRate)}
                      </span>
                    </span>
                  </div>
                  <Progress value={row.adRate * 100} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <ActivationFunnelCard steps={activationFunnel} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Days from install to uninstall
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Distribution of all uninstalls · split by selected dimension
              </p>
            </div>
            <div className="flex flex-wrap gap-1 rounded-md border bg-muted p-1">
              {CHURN_SPLIT_OPTIONS.map((option) => {
                const isActive = option.key === churnSplit;
                const href =
                  option.key === "none"
                    ? "/insights"
                    : `/insights?churn=${option.key}`;
                return (
                  <Link
                    key={option.key}
                    href={href}
                    scroll={false}
                    className={cn(
                      "rounded px-2 py-1 text-[10px] font-medium transition-colors",
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChurnDistributionChart
              data={churnDistribution.data}
              series={churnDistribution.series}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Never activated
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatNumber({ value: churnTypes.neverActivated })}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  uninstalled, no pixel & no revenue ·{" "}
                  {churnTypes.total > 0
                    ? formatPercent(
                        churnTypes.neverActivated / churnTypes.total,
                      )
                    : "—"}{" "}
                  of churn
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Got value, then left
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatNumber({ value: churnTypes.gotValue })}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  pixel installed or had revenue ·{" "}
                  {churnTypes.total > 0
                    ? formatPercent(churnTypes.gotValue / churnTypes.total)
                    : "—"}{" "}
                  of churn
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Install attribution
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Inferred from <code className="text-[10px]">fbclid</code> /{" "}
              <code className="text-[10px]">gclid</code> on app install
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Installs</TableHead>
                  <TableHead className="text-right">Champ rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acquisition.map((row) => {
                  return (
                    <TableRow key={row.source}>
                      <TableCell className="text-xs font-medium capitalize">
                        {row.source}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatNumber({ value: row.installs })}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatPercent(row.championRate)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Plan distribution
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Active subscription plan among installed shops
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <CategoryBarChart
              data={planBreakdown.map((p) => {
                return { label: p.label, count: p.count };
              })}
              total={joined.length}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Currency distribution
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Base currency across every installed shop · top 15
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <CategoryBarChart
              data={currencyBreakdown.map((c) => {
                return { label: c.label, count: c.count };
              })}
              total={allInstalled}
              colorVar="var(--color-chart-3)"
              limit={15}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Tenure vs revenue
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              How long shops have been on Origin and what they make
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenure</TableHead>
                  <TableHead className="text-right">Shops</TableHead>
                  <TableHead className="text-right">Avg monthly GMV</TableHead>
                  <TableHead className="text-right">Total 90d GMV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenure.map((row) => {
                  return (
                    <TableRow key={row.label}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber({ value: row.shops })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency({
                          amount: row.avgMonthlyRevenue,
                          compact: true,
                        })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency({
                          amount: row.totalRevenue90d,
                          compact: true,
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">
              Ad platform adoption
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Which platforms do high-value shops actually use
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {platformAdoption.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">
                No connected platforms yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Shops</TableHead>
                    <TableHead className="text-right">Avg monthly GMV</TableHead>
                    <TableHead className="text-right">Total 90d GMV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platformAdoption.map((row) => {
                    return (
                      <TableRow key={row.platformKey}>
                        <TableCell className="font-medium capitalize">
                          {row.platformKey.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber({ value: row.shopsWithPlatform })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency({
                            amount: row.avgMonthlyRevenue,
                            compact: true,
                          })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency({
                            amount: row.totalRevenue90d,
                            compact: true,
                          })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Top shops by 90-day GMV
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Drill-down candidates for ICP interviews
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Shopify tier</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Ad accounts</TableHead>
                <TableHead className="text-right">90d GMV</TableHead>
                <TableHead className="text-right">Avg/mo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {joined
                .sort((a, b) => b.revenue90d - a.revenue90d)
                .slice(0, 25)
                .map((shop) => {
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
                        {shop.plan ? (
                          <Badge variant="outline">{shop.plan}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
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
                          {shop.shopifyPlanName && !shop.shopifyPlus && !shop.isPartnerDev ? (
                            <span className="text-xs">{shop.shopifyPlanName}</span>
                          ) : null}
                          {!shop.shopifyPlanName && !shop.shopifyPlus && !shop.isPartnerDev ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs uppercase">
                        {shop.currency}
                      </TableCell>
                      <TableCell>
                        {shop.connectedPlatformKeys.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {shop.connectedPlatformKeys.map((key) => {
                              return (
                                <Badge
                                  key={key}
                                  variant="secondary"
                                  className="text-[10px] capitalize"
                                >
                                  {key.replace(/_/g, " ")}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency({
                          amount: shop.revenue90d,
                          compact: true,
                        })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency({
                          amount: shop.monthlyAvgRevenue,
                          compact: true,
                        })}
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

const InsightsSkeleton = () => {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => {
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

type InsightsPageProps = {
  searchParams: Promise<{ churn?: string }>;
};

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const params = await searchParams;
  const churnSplit: ChurnSplitBy = isChurnSplit(params.churn)
    ? params.churn
    : "none";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description="Identify your ICP — segment installed shops by revenue, plan, and ad-account adoption."
        actions={
          <div className="hidden items-center gap-2 sm:flex">
            <Badge variant="outline" className="gap-1">
              <Globe className="h-3 w-3" />
              USD-converted
            </Badge>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Compass className="h-3.5 w-3.5" />
              Last 90 days
            </div>
          </div>
        }
      />

      <Suspense key={churnSplit} fallback={<InsightsSkeleton />}>
        <InsightsBoard churnSplit={churnSplit} />
      </Suspense>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Revenue figures convert each shop&apos;s native currency to USD at fixed mid-market rates
        as of {FX_AS_OF}. Rates are hard-coded for reporting only — not exact, but better than
        excluding non-USD shops. Currencies outside the table fall back to a 1:1 rate.
      </p>
      <p className="text-xs text-muted-foreground">
        On uninstall we delete all shop data except the <code className="text-[10px]">shops</code> row and{" "}
        <code className="text-[10px]">subscriptions</code> records. Activation signals that depend on deleted tables
        (ad accounts, order revenue) are not shown for churned shops in the comparisons above.
      </p>
    </div>
  );
}
