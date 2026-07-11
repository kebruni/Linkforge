import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportsPanel } from "@/features/admin/reports-panel";

export const metadata = { title: "Reports · Admin" };

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Moderation queue</h1>
        <p className="mt-1 text-muted-foreground">Content reports from public pages.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>Resolve or dismiss each report after review.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportsPanel />
        </CardContent>
      </Card>
    </div>
  );
}
