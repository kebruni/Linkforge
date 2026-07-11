"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";

export function PaidBanner() {
  const search = useSearchParams();
  const paid = search.get("paid");
  const demo = search.get("demo") === "1";
  const amount = search.get("amount");
  const currency = search.get("currency") ?? "USD";
  const kind = search.get("kind") ?? "donation";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(paid === "1" || paid === "0");
  }, [paid]);

  if (!visible || paid === null) return null;

  if (paid === "0") {
    return (
      <div className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm shadow-lg sm:inset-x-auto sm:right-4 sm:top-4">
        <span className="flex-1 text-muted-foreground">Payment canceled.</span>
        <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm shadow-lg sm:inset-x-auto sm:right-4 sm:top-4">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-emerald-800 dark:text-emerald-200">
          {kind === "product" ? "Purchase received" : "Thank you for the support!"}
        </p>
        <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
          {amount ? `${currency} ${amount}` : "Payment"} recorded
          {demo ? " (demo mode — no card charged)" : ""}.
        </p>
      </div>
      <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  );
}
