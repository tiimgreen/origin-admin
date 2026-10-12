import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActiveUserRow } from "@/lib/data/activity";
import { formatNumber, shopUserDisplayName } from "@/lib/format";

type TopUsersTableProps = {
  users: Array<ActiveUserRow>;
  hint: string;
};

export const TopUsersTable = ({ users, hint }: TopUsersTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          Most active users
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Shop</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No sessions in this period.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Link
                        href={`/shops/${user.shop}/users/${user.id}`}
                        className="text-xs font-medium hover:underline"
                      >
                        {shopUserDisplayName(user)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {user.shop}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatNumber({ value: user.sessions })}
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
