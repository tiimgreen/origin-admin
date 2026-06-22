"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Award, BarChart3, Compass, LayoutDashboard, LineChart, Magnet, Repeat, Store } from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: Array<NavItem> = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Shops", href: "/shops", icon: Store },
  { label: "Insights", href: "/insights", icon: Compass },
  { label: "Retained ICP", href: "/icp", icon: Award },
  { label: "Cohorts", href: "/cohorts", icon: LineChart },
  { label: "Stickiness", href: "/stickiness", icon: Magnet },
  { label: "App Store", href: "/stickiness/shopify", icon: Store },
  { label: "Lifecycle", href: "/lifecycle", icon: Repeat },
];

export const Sidebar = () => {
  const pathname = usePathname();

  const activeHref = NAV_ITEMS.filter((item) => {
    if (item.href === "/") {
      return pathname === "/";
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  })
    .sort((a, b) => b.href.length - a.href.length)
    .at(0)?.href;

  return (
    <aside className="hidden w-60 flex-col border-r bg-card lg:flex">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Activity className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Origin</span>
          <span className="text-xs text-muted-foreground">Admin</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === activeHref;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          Internal dashboard
        </div>
      </div>
    </aside>
  );
};
