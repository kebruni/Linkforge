"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Heart, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";

function DemoPayInner() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const slug = search.get("slug") ?? "";
  const [pending, setPending] = useState(false);

  async function confirm() {
    if (!token) {
      toast({ variant: "destructive", title: "Missing payment session" });
      return;
    }
    setPending(true);
    const res = await fetch("/api/billing/demo-complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const json = await res.json().catch(() => null);
    setPending(false);
    if (!res.ok || json?.ok === false) {
      toast({
        variant: "destructive",
        title: "Payment failed",
        description: json?.message ?? "Session expired — try again from the page.",
      });
      return;
    }
    toast({ variant: "success", title: "Thank you!", description: "Demo payment recorded." });
    router.replace(json.data.redirect as string);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-accent/15 text-accent">
            <Heart className="size-6" />
          </div>
          <CardTitle>Confirm support</CardTitle>
          <CardDescription>
            Demo checkout — no real card charge. When Stripe keys are set, this becomes live Stripe
            Checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            <p>
              This simulates a successful donation/purchase so you can test the full flow (inbox
              lead + analytics + thank-you redirect).
            </p>
          </div>
          <Button
            type="button"
            variant="accent"
            className="w-full"
            disabled={pending || !token}
            onClick={() => void confirm()}
          >
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Complete demo payment
          </Button>
          {slug ? (
            <Button asChild variant="ghost" className="w-full">
              <Link href={`/u/${slug}?paid=0`}>Cancel</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DemoPayPage() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Loading…</div>}>
      <DemoPayInner />
    </Suspense>
  );
}
