"use client";

import { useRouter } from "next/navigation";

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
  const router = useRouter();

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No users have logged in yet.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                return (
                  <TableRow
                    key={user.id}
                    onClick={() => {
                      router.push(`/shops/${shop}/users/${user.id}`);
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
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
