"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";

const EVENTS = [
  "PAGE_PUBLISHED",
  "FORM_SUBMITTED",
  "PRODUCT_PURCHASED",
  "SUBSCRIPTION_CHANGED",
] as const;

type Hook = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  failureCount: number;
  createdAt: string;
};

export function WebhooksPanel({ isPro }: { isPro: boolean }) {
  const [rows, setRows] = useState<Hook[]>([]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["FORM_SUBMITTED"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isPro) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetch("/api/webhooks");
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok && json?.ok) setRows(json.data as Hook[]);
  }, [isPro]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleEvent(ev: string) {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (events.length === 0) {
      toast({ variant: "destructive", title: "Pick at least one event" });
      return;
    }
    setBusy(true);
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, events }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || json?.ok === false) {
      toast({
        variant: "destructive",
        title: "Could not create webhook",
        description: json?.message ?? "Try again",
      });
      return;
    }
    setSecret(json.data.secret as string);
    setUrl("");
    toast({ variant: "success", title: "Webhook created" });
    void load();
  }

  async function setActive(id: string, active: boolean) {
    await fetch(`/api/webhooks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active }),
    });
    void load();
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    setBusy(false);
    toast({ variant: "success", title: "Webhook deleted" });
    void load();
  }

  if (!isPro) {
    return (
      <p className="text-sm text-muted-foreground">
        Outbound webhooks are a PRO feature. Get notified when forms submit or pages publish.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="space-y-3 rounded-lg border p-3">
        <div className="space-y-1.5">
          <Label htmlFor="wh-url">Endpoint URL</Label>
          <Input
            id="wh-url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/hooks/linkforge"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {EVENTS.map((ev) => (
            <button
              key={ev}
              type="button"
              onClick={() => toggleEvent(ev)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                events.includes(ev) ? "border-accent bg-accent/15 text-foreground" : "text-muted-foreground"
              }`}
            >
              {ev}
            </button>
          ))}
        </div>
        <Button type="submit" size="sm" disabled={busy || !url}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
          Add webhook
        </Button>
      </form>

      {secret && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs">
          <p className="mb-1 font-medium">Signing secret (save it):</p>
          <code className="break-all">{secret}</code>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No webhooks configured.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((h) => (
            <li key={h.id} className="flex items-start gap-3 p-3">
              <Webhook className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{h.url}</div>
                <div className="text-xs text-muted-foreground">
                  {h.events.join(", ")}
                  {h.failureCount > 0 ? ` · ${h.failureCount} failures` : ""}
                </div>
              </div>
              <Switch checked={h.active} onCheckedChange={(v) => setActive(h.id, v)} />
              <Button type="button" size="icon" variant="ghost" onClick={() => remove(h.id)} aria-label="Delete">
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
