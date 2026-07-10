"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

function formatMoney(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export function ProductBlock({
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
  const title = typeof data.title === "string" ? data.title : "Product";
  const description = typeof data.description === "string" ? data.description : null;
  const imageUrl = typeof data.imageUrl === "string" ? data.imageUrl : null;
  const priceMinor = typeof data.priceMinor === "number" ? data.priceMinor : 0;
  const currency = typeof data.currency === "string" ? data.currency : "USD";
  const [pending, setPending] = useState(false);

  async function buy() {
    if (isEditing || !pageId) return;
    setPending(true);
    const res = await fetch("/api/billing/checkout-one-time", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pageId,
        blockId,
        kind: "product",
        amountMinor: priceMinor,
        currency,
        title,
      }),
    });
    const json = await res.json().catch(() => null);
    setPending(false);
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
    <div className="overflow-hidden rounded-[var(--lf-radius)] bg-[color:var(--lf-surface)] ring-1 ring-current/10">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={title} className="h-40 w-full object-cover" loading="lazy" />
      ) : null}
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="shrink-0 text-sm font-medium" style={{ color: "var(--lf-accent)" }}>
            {formatMoney(priceMinor, currency)}
          </span>
        </div>
        {description ? <p className="text-xs opacity-70">{description}</p> : null}
        <Button
          type="button"
          className="w-full"
          style={{ background: "var(--lf-accent)", color: "#fff" }}
          disabled={isEditing || pending}
          onClick={() => void buy()}
        >
          {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Buy now
        </Button>
      </div>
    </div>
  );
}
