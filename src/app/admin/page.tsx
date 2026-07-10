import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Admin" };

export default async function AdminHomePage() {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [users, pages, published, events, reports, openReports] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.page.count({ where: { deletedAt: null } }),
    prisma.page.count({ where: { deletedAt: null, isPublished: true } }),
    prisma.analyticsEvent.count({ where: { occurredAt: { gte: since } } }),
    prisma.contentReport.count(),
    prisma.contentReport.count({ where: { status: "OPEN" } }),
  ]);

  const stats = [
    { label: "Users", value: users },
    { label: "Pages", value: pages },
    { label: "Published", value: published },
    { label: "Events (30d)", value: events },
    { label: "Reports", value: reports },
    { label: "Open reports", value: openReports },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin overview</h1>
        <p className="mt-1 text-muted-foreground">Platform health snapshot.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl">{formatNumber(s.value)}</CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </div>
  );
}
