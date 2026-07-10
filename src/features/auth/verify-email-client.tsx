"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VerifyEmailClient() {
  const search = useSearchParams();
  const token = search.get("token");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    token ? "loading" : "idle",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => null);
      if (cancelled) return;
      if (res.ok && json?.ok) {
        setStatus("ok");
        setMessage("Email verified. You can sign in.");
      } else {
        setStatus("error");
        setMessage(json?.message ?? "Invalid or expired link.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {token ? "Verifying email" : "Check your email"}
      </h1>
      {status === "loading" && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Confirming your address…
        </p>
      )}
      {status === "ok" && <p className="text-sm text-emerald-600">{message}</p>}
      {status === "error" && <p className="text-sm text-destructive">{message}</p>}
      {status === "idle" && (
        <p className="text-sm text-muted-foreground">
          We sent a verification link to your inbox. Click the link to confirm your address.
        </p>
      )}
      {(status === "ok" || status === "error" || status === "idle") && (
        <Button asChild variant="accent">
          <Link href="/login">Go to sign in</Link>
        </Button>
      )}
    </div>
  );
}
