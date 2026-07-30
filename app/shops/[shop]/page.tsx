import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { FeatureFlagsCard } from "@/components/shops/feature-flags-card";
import { RevenueSpendChart } from "@/components/charts/revenue-spend-chart";
import {
  getShopDetail,
  getShopFeatureFlags,
  getShopMonthlyFinancials,
  type ShopDetail,
} from "@/lib/data/shop-profile";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

const formatDate = (iso: string | null) => {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
};

const StatCard = ({ label, value, hint }: StatCardProps) => {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
};

type InfoRowProps = {
  label: string;
  children: React.ReactNode;
};

const InfoRow = ({ label, children }: InfoRowProps) => {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{children}</span>
    </div>
  );
};

const BasicInfoCard = ({ detail }: { detail: ShopDetail }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          Basic info
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y">
          <InfoRow label="Domain">
            <span className="font-mono">{detail.shop}</span>
          </InfoRow>
          <InfoRow label="Install state">
            <Badge variant={detail.isInstalled ? "success" : "secondary"}>
              {detail.isInstalled ? "Installed" : "Uninstalled"}
            </Badge>
          </InfoRow>
          <InfoRow label="Installed at">
            {formatDate(detail.initialInstalledAt)}
          </InfoRow>
          {detail.uninstalledAt ? (
            <InfoRow label="Uninstalled at">
              {formatDate(detail.uninstalledAt)}
            </InfoRow>
          ) : null}
          <InfoRow label="Shopify plan">
            <span className="inline-flex items-center gap-1.5">
              {detail.shopifyPlanName ?? "—"}
              {detail.shopifyPlus ? <Badge variant="warning">Plus</Badge> : null}
              {detail.isPartnerDev ? (
                <Badge variant="secondary">Partner dev</Badge>
              ) : null}
            </span>
          </InfoRow>
          <InfoRow label="Currency">{detail.currency}</InfoRow>
          <InfoRow label="Vertical">{detail.vertical ?? "—"}</InfoRow>
          <InfoRow label="First paid at">{formatDate(detail.firstPaidAt)}</InfoRow>
        </div>
      </CardContent>
    </Card>
  );
};

const FinancialsCard = async ({ detail }: { detail: ShopDetail }) => {
  const financials = await getShopMonthlyFinancials({ shop: detail.shop });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          Revenue vs ad spend
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Last 12 months · monthly totals in USD
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <RevenueSpendChart data={financials} />
      </CardContent>
    </Card>
  );
};

const FinancialsCardSkeleton = () => {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
};

type ShopDetailPageProps = {
  params: Promise<{ shop: string }>;
};

export default async function ShopDetailPage({ params }: ShopDetailPageProps) {
  const { shop } = await params;
  const detail = await getShopDetail({ shop });

  if (!detail) {
    notFound();
  }

  const flags = detail.currentPlan
    ? await getShopFeatureFlags({
        subscriptionId: detail.currentPlan.subscriptionId,
      })
    : [];

  return (
    <div className="space-y-6">
      <Link
        href="/shops"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All shops
      </Link>

      <PageHeader
        title={detail.name ?? detail.shop}
        description={detail.name ? detail.shop : undefined}
        actions={
          <Badge variant={detail.isInstalled ? "success" : "secondary"}>
            {detail.isInstalled ? "Installed" : "Uninstalled"}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Current plan"
          value={detail.currentPlan?.planKey ?? "None"}
          hint={
            detail.currentPlan
              ? `${formatCurrency({ amount: detail.currentPlan.price })}/mo MRR · since ${formatDate(detail.currentPlan.activatedAt)}`
              : "No active subscription"
          }
        />
        <StatCard
          label="LTV"
          value={formatCurrency({ amount: detail.ltv })}
          hint="Estimated from subscription history"
        />
        <StatCard
          label="Installed"
          value={formatDate(detail.initialInstalledAt)}
          hint={detail.uninstalledAt ? `Uninstalled ${formatDate(detail.uninstalledAt)}` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BasicInfoCard detail={detail} />
        <FeatureFlagsCard
          shop={detail.shop}
          subscriptionId={detail.currentPlan?.subscriptionId ?? null}
          flags={flags}
        />
      </div>

      <Suspense fallback={<FinancialsCardSkeleton />}>
        <FinancialsCard detail={detail} />
      </Suspense>
    </div>
  );
}
