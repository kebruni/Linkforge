"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

function formatMoney(units: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(units);
  } catch {
    return `${currency} ${units}`;
  }
}

export function DonationBlock({
  data,
  pageId,
  blockId,
  isEditing = false,
}: {
  data: Record<string, unknown>;
  pageId?: string;
  blockId?: string;
  isEditing?: boolean;
}) {
  const title = typeof data.title === "string" ? data.title : "Support me";
  const currency = typeof data.currency === "string" ? data.currency : "USD";
  const amounts = Array.isArray(data.amounts)
    ? (data.amounts as number[]).filter((n) => typeof n === "number" && n > 0)
    : [3, 5, 10];
  const [pending, setPending] = useState<number | null>(null);

  async function donate(amount: number) {
    if (isEditing || !pageId) return;
    setPending(amount);
    const res = await fetch("/api/billing/checkout-one-time", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pageId,
        blockId,
        kind: "donation",
        amountMinor: amount,
        currency,
        title: `${title} · ${formatMoney(amount, currency)}`,
      }),
    });
    const json = await res.json().catch(() => null);
    setPending(null);
    if (!res.ok || json?.ok === false) {
      toast({
        variant: "destructive",
        title: "Checkout unavailable",
        description: json?.message ?? "Payments are not configured yet.",
      });
      return;
    }
    if (json?.data?.url) window.location.href = json.data.url;
  }

  return (
    <div className="space-y-3 rounded-[var(--lf-radius)] bg-[color:var(--lf-surface)] p-4 ring-1 ring-current/10">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {amounts.map((a) => (
          <Button
            key={a}
            type="button"
            variant="outline"
            size="sm"
            disabled={isEditing || pending !== null}
            onClick={() => void donate(a)}
          >
            {pending === a ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
            {formatMoney(a, currency)}
          </Button>
        ))}
      </div>
      <p className="text-[11px] opacity-50">Secure checkout powered by Stripe.</p>
    </div>
  );
}
