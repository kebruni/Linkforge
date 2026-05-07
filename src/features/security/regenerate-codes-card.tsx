"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

import { RecoveryCodesCard } from "./recovery-codes-card";

interface Props {
  enabled: boolean;
}

export function RegenerateCodesCard({ enabled }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);

  if (!enabled) return null;

  async function regenerate() {
    setPending(true);
    try {
      const res = await fetch("/api/auth/2fa/recovery-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        toast({ variant: "destructive", title: "Couldn't regenerate", description: json?.message });
        return;
      }
      setCodes(json.data.recoveryCodes as string[]);
      setPassword("");
    } finally {
      setPending(false);
    }
  }

  if (codes) {
    return (
      <RecoveryCodesCard
        codes={codes}
        description="New recovery codes generated. Old codes are no longer valid."
        onAcknowledge={() => {
          setCodes(null);
          setOpen(false);
        }}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="size-5" />
          Recovery codes
        </CardTitle>
        <CardDescription>
          Lost your authenticator? Regenerate a fresh batch of single-use
          recovery codes. This invalidates all existing codes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!open ? (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            Regenerate codes
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="regen-password">Password</Label>
              <Input
                id="regen-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="accent"
                disabled={pending || !password}
                onClick={regenerate}
              >
                {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Regenerate
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
