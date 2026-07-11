"use client";

import { useState } from "react";
import { Loader2, Crown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

export function BillingForm({
  role,
  billingEnabled,
  subscription,
}: {
  role: string;
  billingEnabled: boolean;
  subscription: {
    status: string;
    plan: string;
    currentPeriodEnd: string | null;
  } | null;
}) {
  const [pending, setPending] = useState<"monthly" | "yearly" | "portal" | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const isPro = role === "PRO" || role === "ADMIN";

  async function checkout(plan: "PRO_MONTHLY" | "PRO_YEARLY") {
    setPending(plan === "PRO_YEARLY" ? "yearly" : "monthly");
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        plan,
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
      }),
    });
    const json = await res.json().catch(() => null);
    setPending(null);
    if (!res.ok || json?.ok === false) {
      toast({
        variant: "destructive",
        title: "Checkout unavailable",
        description: json?.message ?? "Billing is not configured on this server.",
      });
      return;
    }
    if (json?.data?.url) window.location.href = json.data.url;
  }

  async function openPortal() {
    setPending("portal");
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const json = await res.json().catch(() => null);
    setPending(null);
    if (!res.ok || json?.ok === false) {
      toast({
        variant: "destructive",
        title: "Portal unavailable",
        description: json?.message ?? "No Stripe customer yet.",
      });
      return;
    }
    if (json?.data?.url) window.location.href = json.data.url;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Current plan</span>
        <Badge variant={isPro ? "accent" : "outline"} className="gap-1">
          {isPro && <Crown className="size-3" />}
          {role}
        </Badge>
        {subscription && (
          <span className="text-xs text-muted-foreground">
            {subscription.plan} · {subscription.status}
            {subscription.currentPeriodEnd
              ? ` · renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
              : ""}
          </span>
        )}
      </div>

      {!billingEnabled && (
        <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          Stripe billing is disabled on this environment. Set{" "}
          <code className="rounded bg-muted px-1">FEATURE_BILLING=true</code> and Stripe keys in
          production to enable upgrades.
        </p>
      )}

      {billingEnabled && !isPro && (
        <div className="space-y-3">
          <div className="max-w-xs space-y-1">
            <label htmlFor="coupon" className="text-xs text-muted-foreground">
              Coupon code (optional)
            </label>
            <input
              id="coupon"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="LAUNCH20"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="accent"
              size="sm"
              disabled={!!pending}
              onClick={() => checkout("PRO_MONTHLY")}
            >
              {pending === "monthly" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Upgrade monthly · $8
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!!pending}
              onClick={() => checkout("PRO_YEARLY")}
            >
              {pending === "yearly" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Upgrade yearly · $72
            </Button>
          </div>
        </div>
      )}

      {billingEnabled && subscription?.status && (
        <Button type="button" variant="outline" size="sm" disabled={!!pending} onClick={openPortal}>
          {pending === "portal" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ExternalLink className="mr-2 size-3" />}
          Manage billing
        </Button>
      )}
    </div>
  );
}
