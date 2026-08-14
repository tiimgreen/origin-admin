import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { getShopUserDetail } from "@/lib/data/shop-users";
import { formatNumber, shopUserDisplayName } from "@/lib/format";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

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

const formatDateTime = (iso: string) => {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDuration = (seconds: number) => {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
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

type ShopUserPageProps = {
  params: Promise<{ shop: string; userId: string }>;
};

export default async function ShopUserPage({ params }: ShopUserPageProps) {
  const { shop, userId } = await params;
  const parsedUserId = Number(userId);

  if (!Number.isInteger(parsedUserId)) {
    notFound();
  }

  const user = await getShopUserDetail({ userId: parsedUserId });

  if (!user || user.shop !== shop) {
    notFound();
  }

  const since30dMs = Date.now() - 30 * DAY_MS;
  const sessions30d = user.sessions.filter((session) => {
    return new Date(session.startedAt).getTime() >= since30dMs;
  }).length;
  const lastActiveAt = user.sessions[0]?.lastSeenAt ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        href={`/shops/${shop}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {shop}
      </Link>

      <PageHeader
        title={shopUserDisplayName(user)}
        description={user.email}
        actions={
          <span className="inline-flex items-center gap-1.5">
            {user.accountOwner ? <Badge variant="success">Owner</Badge> : null}
            {user.collaborator ? (
              <Badge variant="secondary">Collaborator</Badge>
            ) : null}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total sessions"
          value={formatNumber({ value: user.sessions.length })}
          hint={`${formatNumber({ value: sessions30d })} in the last 30 days`}
        />
        <StatCard label="Last active" value={formatDate(lastActiveAt)} />
        <StatCard label="First seen" value={formatDate(user.createdAt)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.sessions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No sessions recorded.
                  </TableCell>
                </TableRow>
              ) : (
                user.sessions.map((session) => {
                  return (
                    <TableRow key={session.id}>
                      <TableCell className="text-xs tabular-nums">
                        {formatDateTime(session.startedAt)}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {formatDateTime(session.lastSeenAt)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatDuration(session.durationSeconds)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
