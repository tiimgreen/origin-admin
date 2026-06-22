import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

const DAY_MS = 86_400_000;
const MONTH_MS = DAY_MS * 30.44;
const CHURN_MAX_DAYS = 90;
const STICKY_MIN_DAYS = 180;

const { data: shops, error: shopsError } = await supabase
  .from("shops")
  .select(`
    shop, name, isInstalled, initialInstalledAt, uninstalled_at,
    plan_public_display_name, vertical, order_count_at_install, first_order_created_at,
    app_install_utm_source, app_install_fbclid, app_install_gclid,
    app_install_landing_page, app_install_surface_type, app_install_surface_detail
  `)
  .limit(5000);

const { data: subs, error: subsError } = await supabase
  .from("subscriptions")
  .select(`shop, price, activated_at`)
  .limit(20000);

if (shopsError || subsError) {
  console.error(shopsError ?? subsError);
  process.exit(1);
}

const everPaid = new Set();
for (const s of subs) {
  if (s.activated_at && (s.price ?? 0) > 0) {
    everPaid.add(s.shop);
  }
}

const paid = shops.filter((s) => everPaid.has(s.shop));

const lifespanDays = (s) => {
  if (!s.initialInstalledAt) return null;
  const end = s.uninstalled_at ? new Date(s.uninstalled_at).getTime() : Date.now();
  return (end - new Date(s.initialInstalledAt).getTime()) / DAY_MS;
};

const cohortOf = (s) => {
  const life = lifespanDays(s);
  if (life === null || life < 0) return null;
  if (s.isInstalled !== true && s.uninstalled_at && life < CHURN_MAX_DAYS) return "churned";
  if (life >= STICKY_MIN_DAYS) return "sticky";
  return null;
};

const META = new Set(["fb", "facebook", "meta", "ig", "instagram", "fb_ads", "meta_ads"]);
const GOOGLE = new Set(["google", "adwords", "google_ads", "googleads", "gads"]);

const acquisitionChannel = (s) => {
  const surface = s.app_install_surface_type?.trim().toLowerCase() ?? null;
  if (surface === "search_ad") return "Shopify Ads";
  if (surface === "search") return "Shopify Organic";
  const src = s.app_install_utm_source?.trim().toLowerCase() ?? null;
  if (s.app_install_fbclid || (src && META.has(src))) return "Meta";
  if (s.app_install_gclid || (src && GOOGLE.has(src))) return "Google";
  if (src) return src.charAt(0).toUpperCase() + src.slice(1);
  if (s.app_install_landing_page) return "Direct / Organic";
  return "Unknown";
};

const ordersPerMonth = (s) => {
  if (s.order_count_at_install === null) return null;
  if (s.order_count_at_install === 0) return 0;
  if (!s.first_order_created_at || !s.initialInstalledAt) return null;
  const span = new Date(s.initialInstalledAt).getTime() - new Date(s.first_order_created_at).getTime();
  return s.order_count_at_install / Math.max(1, span / MONTH_MS);
};
const ordersBucket = (s) => {
  const o = ordersPerMonth(s);
  if (o === null) return "Unknown";
  if (o < 1) return "0–1 /mo";
  if (o < 10) return "1–10 /mo";
  if (o < 50) return "10–50 /mo";
  if (o < 200) return "50–200 /mo";
  if (o < 1000) return "200–1k /mo";
  return "1k+ /mo";
};

const sticky = paid.filter((s) => cohortOf(s) === "sticky");
const churned = paid.filter((s) => cohortOf(s) === "churned");

const pct = (n, d) => (d > 0 ? (100 * n) / d : 0);
const fmtPct = (x) => x.toFixed(1).padStart(5) + "%";

const report = (title, pool_s, pool_c, classify, note) => {
  console.log(`\n=== ${title} ===  (sticky n=${pool_s.length}, churned n=${pool_c.length})${note ? "  " + note : ""}`);
  const sc = new Map();
  const cc = new Map();
  for (const s of pool_s) sc.set(classify(s), (sc.get(classify(s)) ?? 0) + 1);
  for (const s of pool_c) cc.set(classify(s), (cc.get(classify(s)) ?? 0) + 1);
  const labels = [...new Set([...sc.keys(), ...cc.keys()])];
  const rows = labels.map((l) => {
    const sn = sc.get(l) ?? 0;
    const cn = cc.get(l) ?? 0;
    const sp = pct(sn, pool_s.length);
    const cp = pct(cn, pool_c.length);
    return { l, sn, cn, sp, cp, delta: sp - cp };
  });
  rows.sort((a, b) => b.sn + b.cn - (a.sn + a.cn));
  console.log("bucket".padEnd(28), "stick_n", "chrn_n", "stick%", "chrn%", "  Δpp");
  for (const r of rows) {
    console.log(
      r.l.padEnd(28),
      String(r.sn).padStart(6),
      String(r.cn).padStart(7),
      fmtPct(r.sp),
      fmtPct(r.cp),
      (r.delta >= 0 ? "+" : "") + r.delta.toFixed(1),
    );
  }
};

console.log(`TOTAL paid merchants: ${paid.length}`);
console.log(`Sticky (>=6mo): ${sticky.length} | Churned (<3mo): ${churned.length}`);

report("Attribution source", sticky, churned, acquisitionChannel);
report("Orders per month at install", sticky, churned, ordersBucket);
report("Shopify plan", sticky, churned, (s) => s.plan_public_display_name ?? "Unknown");
report("Vertical", sticky, churned, (s) => s.vertical ?? "Unknown");

// Shopify App Store channel (ads vs organic) — only shopify surfaces
const surfFilter = (t) => (s) => (s.app_install_surface_type?.trim().toLowerCase() ?? null) === t;
const shopSticky = sticky.filter((s) => ["search", "search_ad"].includes(s.app_install_surface_type?.trim().toLowerCase()));
const shopChurned = churned.filter((s) => ["search", "search_ad"].includes(s.app_install_surface_type?.trim().toLowerCase()));
report("Shopify Ads vs Organic", shopSticky, shopChurned, (s) => {
  const t = s.app_install_surface_type?.trim().toLowerCase();
  return t === "search_ad" ? "Shopify Ads" : "Shopify Organic";
});

const kw = (s) => s.app_install_surface_detail?.trim().toLowerCase() || "(none)";
report("Organic keywords", sticky.filter(surfFilter("search")), churned.filter(surfFilter("search")), kw);
report("Paid ad keywords", sticky.filter(surfFilter("search_ad")), churned.filter(surfFilter("search_ad")), kw);

// Coverage diagnostics
const coverage = (label, fn) => {
  const s = paid.filter(fn).length;
  console.log(`  ${label}: ${s}/${paid.length} (${pct(s, paid.length).toFixed(0)}%)`);
};
console.log("\n=== Coverage (of all paid merchants) ===");
coverage("has surface_type", (s) => s.app_install_surface_type);
coverage("has any install attribution", (s) => s.app_install_surface_type || s.app_install_utm_source || s.app_install_fbclid || s.app_install_gclid || s.app_install_landing_page);
coverage("has vertical", (s) => s.vertical);
coverage("has order_count_at_install", (s) => s.order_count_at_install !== null);
coverage("neither cohort (mid-tenure)", (s) => cohortOf(s) === null);
