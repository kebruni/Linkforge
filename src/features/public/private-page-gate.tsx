"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Client gate for private pages. Cookie unlock is set by /api/pages/unlock.
 */
export function PrivatePageGate({
  pageId,
  title,
}: {
  pageId: string;
  title: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pages/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageId, password }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(json?.message ?? "Incorrect password");
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <Lock className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Private page</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{title}</span> is password-protected.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="page-password">Password</Label>
          <Input
            id="page-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={1}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !password}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Unlock
        </Button>
      </form>
    </div>
  );
}
