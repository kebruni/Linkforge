import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const metadata = { title: "Feature flags · Admin" };

export default async function AdminFlagsPage() {
  const flags = await prisma.featureFlag.findMany({ orderBy: { key: "asc" } });

  const runtime = [
    { key: "FEATURE_AI", enabled: env.FEATURE_AI },
    { key: "FEATURE_BILLING", enabled: env.FEATURE_BILLING },
    { key: "FEATURE_CUSTOM_DOMAINS", enabled: env.FEATURE_CUSTOM_DOMAINS },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Feature flags</h1>
        <p className="mt-1 text-muted-foreground">DB flags plus process env gates.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment gates</CardTitle>
          <CardDescription>From process env (requires redeploy to change).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {runtime.map((f) => (
            <div key={f.key} className="flex items-center justify-between border-b py-2 last:border-0">
              <code className="text-sm">{f.key}</code>
              <Badge variant={f.enabled ? "success" : "outline"}>{f.enabled ? "on" : "off"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database flags</CardTitle>
          <CardDescription>Seeded rows; toggle UI in a later PR.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flags seeded. Run `pnpm prisma db seed`.</p>
          ) : (
            flags.map((f) => (
              <div key={f.key} className="flex items-center justify-between border-b py-2 last:border-0">
                <div>
                  <code className="text-sm">{f.key}</code>
                  <div className="text-xs text-muted-foreground">rollout {f.rollout}%</div>
                </div>
                <Badge variant={f.enabled ? "success" : "outline"}>{f.enabled ? "on" : "off"}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
