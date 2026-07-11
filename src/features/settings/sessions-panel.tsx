"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MonitorSmartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

type SessionRow = {
  id: string;
  deviceLabel: string | null;
  ip: string | null;
  country: string | null;
  createdAt: string;
  lastUsedAt: string;
};

export function SessionsPanel() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sessions");
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok && json?.ok) setRows(json.data as SessionRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(id: string) {
    setBusy(id);
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Could not revoke session" });
      return;
    }
    toast({ variant: "success", title: "Session revoked" });
    void load();
  }

  async function revokeAll() {
    setBusy("all");
    const res = await fetch("/api/sessions", { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Could not revoke sessions" });
      return;
    }
    toast({ variant: "success", title: "All sessions revoked" });
    void load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading sessions…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Devices that signed in recently. Revoke any you don&apos;t recognise.
        </p>
        {rows.length > 0 && (
          <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={revokeAll}>
            Revoke all
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active device sessions recorded yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((s) => (
            <li key={s.id} className="flex items-start gap-3 p-3">
              <MonitorSmartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{s.deviceLabel ?? "Unknown device"}</div>
                <div className="text-xs text-muted-foreground">
                  {[s.ip, s.country].filter(Boolean).join(" · ") || "IP unknown"}
                  {" · "}
                  last active {new Date(s.lastUsedAt).toLocaleString()}
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={busy === s.id}
                onClick={() => revoke(s.id)}
                aria-label="Revoke session"
              >
                {busy === s.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
