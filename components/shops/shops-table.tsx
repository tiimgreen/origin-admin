"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  NumericFilters,
  isActiveCondition,
  type NumericFilterCondition,
} from "@/components/ui/numeric-filters";
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

type ShopsTableProps = {
  shops: Array<ShopListRow>;
};

const DAY_MS = 86_400_000;

type NumericFilterKey =
  | "sessions30d"
  | "originPlanPrice"
  | "revenue30d"
  | "adSpend30d"
  | "ltv";

const NUMERIC_FILTER_FIELDS: Array<{ key: NumericFilterKey; label: string }> = [
  { key: "sessions30d", label: "Sessions (30d)" },
  { key: "originPlanPrice", label: "Origin plan price" },
  { key: "revenue30d", label: "Revenue (30d)" },
  { key: "adSpend30d", label: "Ad spend (30d)" },
  { key: "ltv", label: "LTV" },
];

const FILTERS_STORAGE_KEY = "shops-table-filters";

type StoredFilters = {
  query: string;
  installed: Array<string>;
  plans: Array<string>;
  verticals: Array<string>;
  numericFilters: Record<string, NumericFilterCondition>;
  sorting: SortingState;
};

const matchesCondition = (
  value: number,
  condition: NumericFilterCondition,
): boolean => {
  const target = Number(condition.value);

  if (condition.op === ">") {
    return value > target;
  }
  if (condition.op === ">=") {
    return value >= target;
  }
  if (condition.op === "<") {
    return value < target;
  }
  return value <= target;
};

type DomainLinkProps = {
  shop: string;
  className?: string;
};

const DomainLink = ({ shop, className }: DomainLinkProps) => {
  return (
    <a
      href={`https://${shop}`}
      target="_blank"
      rel="noreferrer"
      className={cn("font-mono hover:text-foreground hover:underline", className)}
    >
      {shop}
    </a>
  );
};

const titleCase = (value: string) => {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const timestamp = (value: string | null): number => {
  return value ? new Date(value).getTime() : 0;
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

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

  return formatDate(lastSeenAt);
};

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

const helper = createColumnHelper<typeof features, ShopListRow>();

const columns = helper.columns([
  helper.accessor("shop", {
    header: "Shop",
    enableSorting: false,
    cell: ({ row }) => {
      const shop = row.original;

      if (!shop.name) {
        return (
          <Link
            href={`/shops/${shop.shop}`}
            className="block max-w-[220px] truncate font-mono hover:underline"
          >
            {shop.shop}
          </Link>
        );
      }

      return (
        <div className="flex flex-col items-start leading-tight">
          <Link
            href={`/shops/${shop.shop}`}
            title={shop.name}
            className="max-w-[220px] truncate font-medium hover:underline"
          >
            {shop.name}
          </Link>
          <DomainLink
            shop={shop.shop}
            className="max-w-[220px] truncate text-[10px] text-muted-foreground"
          />
        </div>
      );
    },
  }),
  helper.accessor("isInstalled", {
    header: "Installed",
    enableSorting: false,
    cell: ({ getValue }) => {
      return (
        <Badge variant={getValue() ? "success" : "secondary"}>
          {getValue() ? "Installed" : "Uninstalled"}
        </Badge>
      );
    },
  }),
  helper.accessor((row) => timestamp(row.initialInstalledAt), {
    id: "initialInstalledAt",
    header: "First installed",
    cell: ({ row }) => formatDate(row.original.initialInstalledAt),
  }),
  helper.accessor((row) => timestamp(row.lastInstalledAt), {
    id: "lastInstalledAt",
    header: "Last installed",
    cell: ({ row }) => formatDate(row.original.lastInstalledAt),
  }),
  helper.accessor("vertical", {
    header: "Vertical",
    enableSorting: false,
    cell: ({ getValue }) => {
      const vertical = getValue();

      return vertical ? (
        <span>{vertical}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  }),
  helper.accessor("shopifyPlanName", {
    header: "Shopify plan",
    enableSorting: false,
    cell: ({ getValue }) => {
      const plan = getValue();

      return plan ? (
        <Badge variant="outline">{plan}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  }),
  helper.accessor("originPlanPrice", {
    id: "originPlanPrice",
    header: "Origin plan",
    cell: ({ row }) => {
      const shop = row.original;

      if (!shop.originPlanKey) {
        return <span className="text-muted-foreground">—</span>;
      }

      return (
        <div className="flex flex-col leading-tight">
          <span className="font-medium">{titleCase(shop.originPlanKey)}</span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {formatCurrency({ amount: shop.originPlanPrice })}/mo
          </span>
        </div>
      );
    },
  }),
  helper.accessor("sessions30d", {
    header: "Sessions (30d)",
    cell: ({ getValue }) => formatNumber({ value: getValue() }),
  }),
  helper.accessor((row) => timestamp(row.lastSeenAt), {
    id: "lastSeenAt",
    header: "Last active",
    cell: ({ row }) => formatLastActive(row.original.lastSeenAt),
  }),
  helper.accessor("revenue30d", {
    header: "Revenue (30d)",
    cell: ({ getValue }) => formatCurrency({ amount: getValue(), compact: true }),
  }),
  helper.accessor("adSpend30d", {
    header: "Ad spend (30d)",
    cell: ({ getValue }) => formatCurrency({ amount: getValue(), compact: true }),
  }),
  helper.accessor("ltv", {
    header: "LTV",
    cell: ({ getValue }) => formatCurrency({ amount: getValue(), compact: true }),
  }),
]);

export const ShopsTable = ({ shops }: ShopsTableProps) => {
  const [query, setQuery] = useState("");
  const [installed, setInstalled] = useState<Array<string>>(["Installed"]);
  const [plans, setPlans] = useState<Array<string>>([]);
  const [verticals, setVerticals] = useState<Array<string>>([]);
  const [numericFilters, setNumericFilters] = useState<
    Record<string, NumericFilterCondition>
  >({});
  const [sorting, setSorting] = useState<SortingState>([
    { id: "revenue30d", desc: true },
  ]);

  // Filters survive navigating to a shop and back. Restore runs before the
  // save effect below, so the stored values are read before being rewritten.
  // Restoring in an effect (not a useState initializer) keeps server and
  // client initial renders identical, so setState here is intentional.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const stored = JSON.parse(raw) as Partial<StoredFilters>;

      if (typeof stored.query === "string") {
        setQuery(stored.query);
      }
      if (Array.isArray(stored.installed)) {
        setInstalled(stored.installed);
      }
      if (Array.isArray(stored.plans)) {
        setPlans(stored.plans);
      }
      if (Array.isArray(stored.verticals)) {
        setVerticals(stored.verticals);
      }
      if (stored.numericFilters && typeof stored.numericFilters === "object") {
        setNumericFilters(stored.numericFilters);
      }
      if (Array.isArray(stored.sorting) && stored.sorting.length > 0) {
        setSorting(stored.sorting);
      }
    } catch {
      // Corrupted storage — keep the defaults.
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const stored: StoredFilters = {
      query,
      installed,
      plans,
      verticals,
      numericFilters,
      sorting,
    };
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(stored));
  }, [query, installed, plans, verticals, numericFilters, sorting]);

  const planOptions = useMemo(() => {
    const set = new Set<string>();
    for (const shop of shops) {
      if (shop.shopifyPlanName) {
        set.add(shop.shopifyPlanName);
      }
    }
    return Array.from(set).sort();
  }, [shops]);

  const verticalOptions = useMemo(() => {
    const set = new Set<string>();
    for (const shop of shops) {
      if (shop.vertical) {
        set.add(shop.vertical);
      }
    }
    return Array.from(set).sort();
  }, [shops]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return shops.filter((shop) => {
      if (
        installed.length > 0 &&
        !installed.includes(shop.isInstalled ? "Installed" : "Uninstalled")
      ) {
        return false;
      }
      if (
        plans.length > 0 &&
        !(shop.shopifyPlanName && plans.includes(shop.shopifyPlanName))
      ) {
        return false;
      }
      if (
        verticals.length > 0 &&
        !(shop.vertical && verticals.includes(shop.vertical))
      ) {
        return false;
      }
      for (const field of NUMERIC_FILTER_FIELDS) {
        const condition = numericFilters[field.key];
        if (
          isActiveCondition(condition) &&
          !matchesCondition(shop[field.key], condition)
        ) {
          return false;
        }
      }
      if (needle.length > 0) {
        return (
          shop.shop.toLowerCase().includes(needle) ||
          (shop.name?.toLowerCase().includes(needle) ?? false)
        );
      }
      return true;
    });
  }, [shops, query, installed, plans, verticals, numericFilters]);

  const table = useTable({
    features,
    columns,
    data: filtered,
    getRowId: (row) => row.shop,
    state: { sorting },
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    enableMultiSort: false,
    sortDescFirst: true,
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 px-6">
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

        <MultiSelect
          label="Install state"
          options={["Installed", "Uninstalled"]}
          selected={installed}
          onChange={setInstalled}
        />

        <MultiSelect
          label="Shopify plan"
          options={planOptions}
          selected={plans}
          onChange={setPlans}
        />

        <MultiSelect
          label="Vertical"
          options={verticalOptions}
          selected={verticals}
          onChange={setVerticals}
        />

        <NumericFilters
          label="Metrics"
          fields={NUMERIC_FILTER_FIELDS}
          conditions={numericFilters}
          onChange={setNumericFilters}
        />

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} shops
        </span>
      </div>

      <Table className="text-xs">
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header, index) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                const Icon = sorted === "asc" ? ArrowUp : ArrowDown;

                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "h-9 whitespace-nowrap bg-muted/40 px-3",
                      canSort && "text-right",
                      index === 0 && "pl-6",
                      index === group.headers.length - 1 && "pr-6",
                    )}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={() => {
                          header.column.toggleSorting();
                        }}
                        className={cn(
                          "inline-flex items-center gap-1 uppercase transition-colors hover:text-foreground",
                          sorted && "text-foreground",
                        )}
                      >
                        <table.FlexRender header={header} />
                        {sorted ? <Icon className="h-3 w-3" /> : null}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No shops match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const cells = row.getAllCells();

              return (
                <TableRow key={row.id}>
                  {cells.map((cell, index) => {
                    if (cell.column.id === "shop") {
                      return (
                        <TableCell
                          key={cell.id}
                          className="whitespace-nowrap py-2 pl-6 pr-3"
                        >
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      );
                    }

                    // A <tr> can't be an anchor, so each cell holds a real
                    // link to the shop detail page — the whole row navigates
                    // like a regular link (cmd+click, middle-click, etc.).
                    return (
                      <TableCell key={cell.id} className="p-0">
                        <Link
                          href={`/shops/${row.original.shop}`}
                          tabIndex={-1}
                          className={cn(
                            "block whitespace-nowrap px-3 py-2",
                            cell.column.getCanSort() &&
                              "text-right tabular-nums",
                            index === cells.length - 1 && "pr-6",
                          )}
                        >
                          <table.FlexRender cell={cell} />
                        </Link>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
