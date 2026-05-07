"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Monitor, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

interface Session {
  id: string;
  deviceLabel: string;
  ip: string | null;
  country: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  twoFactorPassedAt: string | null;
  isCurrent: boolean;
}

interface Props {
  initialSessions: Session[];
}

function relative(input: string) {
  const ts = new Date(input).getTime();
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(input).toLocaleDateString();
}

export function SessionsList({ initialSessions }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  async function revoke(id: string) {
    setPendingId(id);
    try {
      const res = await fetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        toast({ variant: "destructive", title: "Couldn't revoke", description: json?.message });
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast({ variant: "success", title: "Session revoked" });
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function revokeAll() {
    setRevokingAll(true);
    try {
      const res = await fetch("/api/auth/sessions/revoke-all", { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        toast({ variant: "destructive", title: "Couldn't revoke", description: json?.message });
        return;
      }
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      toast({
        variant: "success",
        title: "Revoked",
        description: `Signed out from ${json.data.revoked} other device${
          json.data.revoked === 1 ? "" : "s"
        }.`,
      });
      router.refresh();
    } finally {
      setRevokingAll(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Monitor className="size-5" />
            Active sessions
          </CardTitle>
          <CardDescription>
            Devices and browsers currently signed in to your account.
          </CardDescription>
        </div>
        {sessions.some((s) => !s.isCurrent) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={revokeAll}
            disabled={revokingAll}
          >
            {revokingAll && <Loader2 className="mr-2 size-4 animate-spin" />}
            Sign out other devices
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                {s.deviceLabel}
                {s.isCurrent && <Badge variant="success">This device</Badge>}
                {s.twoFactorPassedAt && (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
                    <ShieldCheck className="mr-1 size-3" />
                    2FA verified
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {[s.country, s.ip].filter(Boolean).join(" · ") || "Location unknown"} ·{" "}
                signed in {relative(s.createdAt)} · last used {relative(s.lastUsedAt)}
              </div>
            </div>
            {!s.isCurrent && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => revoke(s.id)}
                disabled={pendingId === s.id}
              >
                {pendingId === s.id && <Loader2 className="mr-2 size-4 animate-spin" />}
                Revoke
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
