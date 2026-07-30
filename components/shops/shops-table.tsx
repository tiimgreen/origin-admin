"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { ShopListRow } from "@/lib/data/shops";

type InstalledFilter = "all" | "installed" | "uninstalled";

type SortKey = "sessions30d" | "lastSeenAt" | "revenue30d" | "adSpend30d";

type SortState = {
  key: SortKey;
  direction: "asc" | "desc";
};

type ShopsTableProps = {
  shops: Array<ShopListRow>;
};

const DAY_MS = 86_400_000;

const formatLastActive = (lastSeenAt: string | null) => {
  if (!lastSeenAt) {
    return "—";
  }

  const days = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / DAY_MS);

  if (days <= 0) {
    return "today";
  }
  if (days < 30) {
    return `${days}d ago`;
  }

  return new Date(lastSeenAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const sortValue = (shop: ShopListRow, key: SortKey): number => {
  if (key === "lastSeenAt") {
    return shop.lastSeenAt ? new Date(shop.lastSeenAt).getTime() : 0;
  }
  return shop[key];
};

export const ShopsTable = ({ shops }: ShopsTableProps) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [installed, setInstalled] = useState<InstalledFilter>("installed");
  const [plan, setPlan] = useState("all");
  const [sort, setSort] = useState<SortState>({
    key: "revenue30d",
    direction: "desc",
  });

  const plans = useMemo(() => {
    const set = new Set<string>();
    for (const shop of shops) {
      if (shop.shopifyPlanName) {
        set.add(shop.shopifyPlanName);
      }
    }
    return Array.from(set).sort();
  }, [shops]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const rows = shops.filter((shop) => {
      if (installed === "installed" && !shop.isInstalled) {
        return false;
      }
      if (installed === "uninstalled" && shop.isInstalled) {
        return false;
      }
      if (plan !== "all" && shop.shopifyPlanName !== plan) {
        return false;
      }
      if (needle.length > 0) {
        return (
          shop.shop.toLowerCase().includes(needle) ||
          (shop.name?.toLowerCase().includes(needle) ?? false)
        );
      }
      return true;
    });

    return rows.sort((a, b) => {
      const delta = sortValue(a, sort.key) - sortValue(b, sort.key);
      return sort.direction === "desc" ? -delta : delta;
    });
  }, [shops, query, installed, plan, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "desc" ? "asc" : "desc" };
      }
      return { key, direction: "desc" };
    });
  };

  const sortableHead = (key: SortKey, label: string) => {
    const isActive = sort.key === key;
    const Icon = sort.direction === "desc" ? ArrowDown : ArrowUp;

    return (
      <TableHead className="text-right">
        <button
          type="button"
          onClick={() => {
            toggleSort(key);
          }}
          className={cn(
            "inline-flex items-center gap-1 transition-colors hover:text-foreground",
            isActive && "text-foreground",
          )}
        >
          {label}
          {isActive ? <Icon className="h-3 w-3" /> : null}
        </button>
      </TableHead>
    );
  };

  const selectClassName =
    "h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
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

        <select
          value={installed}
          onChange={(e) => {
            setInstalled(e.target.value as InstalledFilter);
          }}
          className={selectClassName}
        >
          <option value="all">All shops</option>
          <option value="installed">Installed</option>
          <option value="uninstalled">Uninstalled</option>
        </select>

        <select
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
          }}
          className={selectClassName}
        >
          <option value="all">All Shopify plans</option>
          {plans.map((planName) => {
            return (
              <option key={planName} value={planName}>
                {planName}
              </option>
            );
          })}
        </select>

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} shops
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shop</TableHead>
            <TableHead>Installed</TableHead>
            <TableHead>Shopify plan</TableHead>
            {sortableHead("sessions30d", "Sessions (30d)")}
            {sortableHead("lastSeenAt", "Last active")}
            {sortableHead("revenue30d", "Revenue (30d)")}
            {sortableHead("adSpend30d", "Ad spend (30d)")}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No shops match the current filters.
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
                    <Badge variant={shop.isInstalled ? "success" : "secondary"}>
                      {shop.isInstalled ? "Installed" : "Uninstalled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {shop.shopifyPlanName ? (
                      <Badge variant="outline">{shop.shopifyPlanName}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber({ value: shop.sessions30d })}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {formatLastActive(shop.lastSeenAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency({ amount: shop.revenue30d, compact: true })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency({ amount: shop.adSpend30d, compact: true })}
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
