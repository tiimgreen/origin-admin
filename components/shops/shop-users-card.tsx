"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

import { UserSessionsChart } from "@/components/charts/user-sessions-chart";
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
import { formatNumber, shopUserDisplayName } from "@/lib/format";
import type { ShopUserListRow } from "@/lib/data/shop-users";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;

const formatLastActive = (lastActiveAt: string | null) => {
  if (!lastActiveAt) {
    return "—";
  }

  const days = Math.floor(
    (Date.now() - new Date(lastActiveAt).getTime()) / DAY_MS,
  );

  if (days <= 0) {
    return "today";
  }
  if (days < 30) {
    return `${days}d ago`;
  }

  return new Date(lastActiveAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

type ShopUsersCardProps = {
  shop: string;
  users: Array<ShopUserListRow>;
};

export const ShopUsersCard = ({ shop, users }: ShopUsersCardProps) => {
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          Users
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Staff who have logged into Origin
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Sessions (30d)</TableHead>
              <TableHead className="text-right">Last active</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No users have logged in yet.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const expanded = expandedUserId === user.id;

                return (
                  <Fragment key={user.id}>
                    <TableRow
                      onClick={() => {
                        setExpandedUserId(expanded ? null : user.id);
                      }}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                          {shopUserDisplayName(user)}
                          {user.accountOwner ? (
                            <Badge variant="outline">Owner</Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatNumber({ value: user.sessions30d })}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatLastActive(user.lastActiveAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 text-muted-foreground transition-transform",
                            expanded && "rotate-180",
                          )}
                        />
                      </TableCell>
                    </TableRow>
                    {expanded ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="bg-muted/30 px-4 py-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Sessions per day · last 30 days
                            </span>
                            <Link
                              href={`/shops/${shop}/users/${user.id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                            >
                              All sessions
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                          <UserSessionsChart data={user.dailySessions30d} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
