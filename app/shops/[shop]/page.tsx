import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { AppNameLookupCard } from "@/components/shops/app-name-lookup-card";
import { FeatureFlagsCard } from "@/components/shops/feature-flags-card";
import { ReviewCard } from "@/components/shops/review-card";
import { ShopUsersCard } from "@/components/shops/shop-users-card";
import { RevenueSpendChart } from "@/components/charts/revenue-spend-chart";
import { getShopReview } from "@/lib/data/app-reviews";
import {
  getShopDetail,
  getShopFeatureFlags,
  getShopMonthlyFinancials,
  type ShopDetail,
} from "@/lib/data/shop-profile";
import { getShopUsers } from "@/lib/data/shop-users";
import { formatCurrency, formatDurationWords, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type StorefrontLinkProps = {
  shop: string;
  className?: string;
};

const StorefrontLink = ({ shop, className }: StorefrontLinkProps) => {
  return (
    <a
      href={`https://${shop}`}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1 font-mono hover:text-foreground hover:underline",
        className,
      )}
    >
      {shop}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
};

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
            <span className="inline-flex items-center gap-1.5">
              <StorefrontLink shop={detail.shop} />
              <CopyButton value={detail.shop} />
            </span>
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

const UsersCard = async ({ detail }: { detail: ShopDetail }) => {
  const users = await getShopUsers({ shop: detail.shop });

  return <ShopUsersCard shop={detail.shop} users={users} />;
};

const ShopReviewCard = async ({ detail }: { detail: ShopDetail }) => {
  const review = await getShopReview({ shopName: detail.name });

  return <ReviewCard review={review} />;
};

const ReviewCardSkeleton = () => {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
};

const UsersCardSkeleton = () => {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-32 w-full" />
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
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        href="/shops"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All shops
      </Link>

      <PageHeader
        title={detail.name ?? detail.shop}
        description={
          detail.name ? (
            <span className="inline-flex items-center gap-1.5">
              <StorefrontLink shop={detail.shop} />
              <CopyButton value={detail.shop} />
            </span>
          ) : undefined
        }
        actions={
          <Badge variant={detail.isInstalled ? "success" : "secondary"}>
            {detail.isInstalled ? "Installed" : "Uninstalled"}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Current plan"
          value={detail.currentPlan ? titleCase(detail.currentPlan.planKey) : "None"}
          hint={
            detail.currentPlan
              ? `${formatCurrency({ amount: detail.currentPlan.price, decimals: 0 })}/mo MRR · since ${formatDate(detail.currentPlan.activatedAt)}`
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
          value={
            detail.initialInstalledAt
              ? formatDurationWords({
                  from: detail.initialInstalledAt,
                  to: detail.uninstalledAt,
                })
              : "—"
          }
          hint={[
            formatDate(detail.initialInstalledAt),
            detail.uninstalledAt ? `Uninstalled ${formatDate(detail.uninstalledAt)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BasicInfoCard detail={detail} />
        <FeatureFlagsCard
          shop={detail.shop}
          subscriptionId={detail.currentPlan?.subscriptionId ?? null}
          flags={flags}
        />
        <Suspense fallback={<ReviewCardSkeleton />}>
          <ShopReviewCard detail={detail} />
        </Suspense>
        <AppNameLookupCard shop={detail.shop} />
      </div>

      <Suspense fallback={<UsersCardSkeleton />}>
        <UsersCard detail={detail} />
      </Suspense>

      <Suspense fallback={<FinancialsCardSkeleton />}>
        <FinancialsCard detail={detail} />
      </Suspense>
    </div>
  );
}
