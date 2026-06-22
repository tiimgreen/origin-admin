"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";

export type ShopRow = {
  shop: string;
  name: string | null;
  plan: string | null;
  revenue90d: number;
};

type ShopsTableProps = {
  shops: Array<ShopRow>;
};

export const ShopsTable = ({ shops }: ShopsTableProps) => {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
      return shops;
    }
    return shops.filter((shop) => {
      return (
        shop.shop.toLowerCase().includes(needle) ||
        (shop.name?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [shops, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="Search by name or domain…"
          className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shop</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead className="text-right">90d GMV</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No shops match “{query}”.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((shop) => {
              return (
                <TableRow
                  key={shop.shop}
                  onClick={() => {
                    router.push(`/shops/${shop.shop}`);
                  }}
                  className="cursor-pointer"
                >
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
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency({ amount: shop.revenue90d, compact: true })}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
