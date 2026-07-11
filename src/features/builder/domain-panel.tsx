"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Globe, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

type DomainState = {
  featureEnabled: boolean;
  allowed: boolean;
  domain: {
    id: string;
    domain: string;
    verifiedAt: string | null;
    txtVerifyKey: string;
  } | null;
};

export function DomainPanel({ pageId }: { pageId: string }) {
  const [state, setState] = useState<DomainState | null>(null);
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/pages/${pageId}/domain`);
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok) setState(json.data as DomainState);
  }, [pageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function attach(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/pages/${pageId}/domain`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || json?.ok === false) {
      toast({
        variant: "destructive",
        title: "Could not add domain",
        description: json?.message ?? "Try again",
      });
      return;
    }
    setDomain("");
    toast({ variant: "success", title: "Domain added — verify DNS" });
    void load();
  }

  async function verify() {
    setBusy(true);
    const res = await fetch(`/api/pages/${pageId}/domain`, { method: "PUT" });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || json?.ok === false) {
      toast({
        variant: "destructive",
        title: "Not verified yet",
        description: json?.message ?? "Check DNS and try again",
      });
      return;
    }
    toast({ variant: "success", title: "Domain verified" });
    void load();
  }

  async function remove() {
    setBusy(true);
    await fetch(`/api/pages/${pageId}/domain`, { method: "DELETE" });
    setBusy(false);
    toast({ variant: "success", title: "Domain removed" });
    void load();
  }

  if (!state) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading domain…
      </div>
    );
  }

  if (!state.featureEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Custom domains are disabled on this deployment (FEATURE_CUSTOM_DOMAINS).
      </p>
    );
  }

  if (!state.allowed) {
    return (
      <p className="text-sm text-muted-foreground">
        Custom domains require PRO. Upgrade in Settings → Billing.
      </p>
    );
  }

  const d = state.domain;

  return (
    <div className="space-y-3">
      {!d ? (
        <form onSubmit={attach} className="space-y-2">
          <Label htmlFor="custom-domain">Hostname</Label>
          <div className="flex gap-2">
            <Input
              id="custom-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="links.example.com"
              required
            />
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
              <span className="ml-2">Add</span>
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                {d.domain}
                {d.verifiedAt ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="size-3.5" /> Verified
                  </span>
                ) : (
                  <span className="text-xs text-amber-600">Pending verification</span>
                )}
              </div>
              {!d.verifiedAt && (
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>Add a DNS TXT record:</p>
                  <p>
                    Host: <code className="rounded bg-muted px-1">_linkforge.{d.domain}</code>
                  </p>
                  <p>
                    Value: <code className="break-all rounded bg-muted px-1">{d.txtVerifyKey}</code>
                  </p>
                </div>
              )}
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={remove} disabled={busy}>
              <Trash2 className="size-4" />
            </Button>
          </div>
          {!d.verifiedAt && (
            <Button type="button" size="sm" onClick={verify} disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Check DNS
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
