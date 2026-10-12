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
import type { ActiveShopRow } from "@/lib/data/activity";
import { formatNumber } from "@/lib/format";

type TopShopsTableProps = {
  shops: Array<ActiveShopRow>;
  hint: string;
};

export const TopShopsTable = ({ shops, hint }: TopShopsTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          Most active shops
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shop</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shops.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No sessions in this period.
                </TableCell>
              </TableRow>
            ) : (
              shops.map((row) => {
                return (
                  <TableRow key={row.shop}>
                    <TableCell>
                      <Link
                        href={`/shops/${row.shop}`}
                        className="text-xs font-medium hover:underline"
                      >
                        {row.shop}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatNumber({ value: row.sessions })}
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
