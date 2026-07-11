import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";
import { AnalyticsChart } from "@/features/analytics/analytics-chart";

export const metadata = { title: "Analytics" };

function topCounts(
  rows: { key: string | null; _count: { _all: number } }[],
  limit = 8,
): { label: string; count: number }[] {
  return rows
    .filter((r) => r.key)
    .map((r) => ({ label: r.key as string, count: r._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);

  const eventSince = new Date();
  eventSince.setDate(eventSince.getDate() - 29);

  const [rows, totals, byCountry, byDevice, byUtm, byReferer] = await Promise.all([
    prisma.analyticsDaily.findMany({
      where: { ownerId: session.user.id, day: { gte: since } },
      orderBy: { day: "asc" },
      select: { day: true, views: true, uniques: true, clicks: true, formSubmits: true },
    }),
    prisma.analyticsDaily.aggregate({
      where: { ownerId: session.user.id, day: { gte: since } },
      _sum: { views: true, uniques: true, clicks: true, formSubmits: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["country"],
      where: {
        ownerId: session.user.id,
        occurredAt: { gte: eventSince },
        country: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
      take: 10,
    }),
    prisma.analyticsEvent.groupBy({
      by: ["device"],
      where: {
        ownerId: session.user.id,
        occurredAt: { gte: eventSince },
        device: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { device: "desc" } },
      take: 8,
    }),
    prisma.analyticsEvent.groupBy({
      by: ["utmSource"],
      where: {
        ownerId: session.user.id,
        occurredAt: { gte: eventSince },
        utmSource: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { utmSource: "desc" } },
      take: 8,
    }),
    prisma.analyticsEvent.groupBy({
      by: ["referer"],
      where: {
        ownerId: session.user.id,
        occurredAt: { gte: eventSince },
        referer: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { referer: "desc" } },
      take: 8,
    }),
  ]);

  // Fill missing days with zeros so charts render correctly even with sparse data
  const days = new Map<string, { views: number; uniques: number; clicks: number }>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    days.set(d.toISOString().slice(0, 10), { views: 0, uniques: 0, clicks: 0 });
  }
  for (const r of rows) {
    const k = r.day.toISOString().slice(0, 10);
    days.set(k, { views: r.views, uniques: r.uniques, clicks: r.clicks });
  }
  const series = Array.from(days, ([day, v]) => ({ day, ...v }));

  const countries = topCounts(
    byCountry.map((r) => ({ key: r.country, _count: r._count })),
  );
  const devices = topCounts(byDevice.map((r) => ({ key: r.device, _count: r._count })));
  const utms = topCounts(byUtm.map((r) => ({ key: r.utmSource, _count: r._count })));
  const referers = topCounts(
    byReferer.map((r) => ({
      key: r.referer ? (() => {
        try {
          return new URL(r.referer).hostname;
        } catch {
          return r.referer.slice(0, 40);
        }
      })() : null,
      _count: r._count,
    })),
  );

  const stats = [
    { label: "Views", value: totals._sum.views ?? 0 },
    { label: "Uniques", value: totals._sum.uniques ?? 0 },
    { label: "Clicks", value: totals._sum.clicks ?? 0 },
    { label: "Form submits", value: totals._sum.formSubmits ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Last 30 days · roll-ups + event dimensions.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-2xl">{formatNumber(s.value)}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Views vs clicks</CardTitle>
          <CardDescription>Aggregated across all pages.</CardDescription>
        </CardHeader>
        <CardContent className="h-[240px] w-full min-w-0 sm:h-[320px]">
          <AnalyticsChart data={series} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="Top countries" rows={countries} />
        <BreakdownCard title="Devices" rows={devices} />
        <BreakdownCard title="UTM sources" rows={utms} empty="No UTM traffic yet — append ?utm_source=… to links." />
        <BreakdownCard title="Referrers" rows={referers} />
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  empty = "No data yet.",
}: {
  title: string;
  rows: { label: string; count: number }[];
  empty?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{r.label}</span>
                <span className="tabular-nums text-muted-foreground">{formatNumber(r.count)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
