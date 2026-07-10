import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const submissions = await prisma.formSubmission.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      payload: true,
      country: true,
      createdAt: true,
      page: { select: { slug: true, title: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-1 text-muted-foreground">Form submissions from your public pages.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>Latest 100 entries across all pages.</CardDescription>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
              No leads yet. Add a Form block to a published page to start capturing them.
            </div>
          ) : (
            <ul className="divide-y">
              {submissions.map((s) => (
                <li key={s.id} className="py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-sm font-medium">
                      {s.page.title}{" "}
                      <span className="font-normal text-muted-foreground">/u/{s.page.slug}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.createdAt.toLocaleString()}
                      {s.country && s.country !== "ZZ" ? ` · ${s.country}` : ""}
                    </div>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(s.payload, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
