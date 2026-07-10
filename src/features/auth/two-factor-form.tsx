"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

export function TwoFactorForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/dashboard";
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const json = await res.json().catch(() => null);
    setPending(false);
    if (!res.ok || json?.ok === false) {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: json?.message ?? "Invalid code",
      });
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Authenticator code</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          minLength={6}
          maxLength={32}
        />
        <p className="text-xs text-muted-foreground">
          Enter a 6-digit code from your app, or a recovery code.
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={pending || code.length < 6} variant="accent">
        {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Verify
      </Button>
    </form>
  );
}
