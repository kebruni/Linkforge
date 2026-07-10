import { ShortLinksPanel } from "@/features/links/short-links-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Short links" };

export default function ShortLinksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Short links</h1>
        <p className="mt-1 text-muted-foreground">
          Create branded redirects under <code className="text-xs">/api/short/…</code> with hit tracking.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your links</CardTitle>
          <CardDescription>Share campaign URLs without long query strings.</CardDescription>
        </CardHeader>
        <CardContent>
          <ShortLinksPanel />
        </CardContent>
      </Card>
    </div>
  );
}
