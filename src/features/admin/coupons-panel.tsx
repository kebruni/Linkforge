"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  percentOff: number | null;
  amountOffMinor: number | null;
  currency: string;
  redemptions: number;
  maxRedemptions: number | null;
  expiresAt: string | null;
  createdAt: string;
};

export function CouponsPanel() {
  const [rows, setRows] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("20");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/coupons");
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok && json?.ok) setRows(json.data as Coupon[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: code.toUpperCase(),
        percentOff: Number(percentOff),
      }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || json?.ok === false) {
      toast({
        variant: "destructive",
        title: "Could not create coupon",
        description: json?.message ?? "Try again",
      });
      return;
    }
    setCode("");
    toast({ variant: "success", title: "Coupon created" });
    void load();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="coupon-code">Code</Label>
          <Input
            id="coupon-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LAUNCH20"
            required
            pattern="[A-Za-z0-9_-]+"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="coupon-pct">Percent off</Label>
          <Input
            id="coupon-pct"
            type="number"
            min={1}
            max={100}
            value={percentOff}
            onChange={(e) => setPercentOff(e.target.value)}
            required
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
            Create
          </Button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No coupons yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <span className="font-mono font-semibold">{c.code}</span>
                <span className="ml-2 text-muted-foreground">
                  {c.percentOff != null ? `${c.percentOff}% off` : `${c.amountOffMinor} ${c.currency}`}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {c.redemptions}
                {c.maxRedemptions != null ? `/${c.maxRedemptions}` : ""} redemptions
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
