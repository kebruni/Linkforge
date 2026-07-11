"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
};

export function ApiKeysPanel({ isPro }: { isPro: boolean }) {
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isPro) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetch("/api/api-keys");
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok && json?.ok) setRows(json.data as KeyRow[]);
  }, [isPro]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || json?.ok === false) {
      toast({
        variant: "destructive",
        title: "Could not create key",
        description: json?.message ?? "Try again",
      });
      return;
    }
    setRevealed(json.data.key as string);
    setName("");
    toast({ variant: "success", title: "API key created — copy it now" });
    void load();
  }

  async function revoke(id: string) {
    setBusy(true);
    const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Could not revoke key" });
      return;
    }
    toast({ variant: "success", title: "Key revoked" });
    void load();
  }

  if (!isPro) {
    return (
      <p className="text-sm text-muted-foreground">
        API keys are a PRO feature. Upgrade to integrate Linkforge with your tools.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={createKey} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="key-name">Key name</Label>
          <Input
            id="key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="CI bot"
            required
            maxLength={64}
          />
        </div>
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <KeyRound className="mr-2 size-4" />}
          Create key
        </Button>
      </form>

      {revealed && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
          <p className="mb-1 text-xs font-medium text-accent">Copy this key — it won&apos;t be shown again</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{revealed}</code>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(revealed);
                toast({ variant: "success", title: "Copied" });
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No API keys yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((k) => (
            <li key={k.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{k.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {k.prefix}… · {k.scopes.join(", ")} · created{" "}
                  {new Date(k.createdAt).toLocaleDateString()}
                </div>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => revoke(k.id)} aria-label="Revoke">
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
