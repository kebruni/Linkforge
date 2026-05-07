"use client";

import Image from "next/image";
import { useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

import { RecoveryCodesCard } from "./recovery-codes-card";

interface Props {
  initialEnabled: boolean;
}

interface SetupResponse {
  secret: string;
  uri: string;
  qrDataUrl: string;
  account: string;
  issuer: string;
}

type Step = "idle" | "scan" | "verify" | "show-codes" | "disable";

export function TwoFactorCard({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<Step>("idle");
  const [pending, setPending] = useState(false);
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  async function startSetup() {
    setPending(true);
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        toast({ variant: "destructive", title: "Couldn't start setup", description: json?.message });
        return;
      }
      setSetup(json.data as SetupResponse);
      setStep("scan");
    } finally {
      setPending(false);
    }
  }

  async function confirmEnable() {
    setPending(true);
    try {
      const res = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        toast({ variant: "destructive", title: "Couldn't enable", description: json?.message });
        return;
      }
      setRecoveryCodes(json.data.recoveryCodes as string[]);
      setEnabled(true);
      setStep("show-codes");
      setCode("");
    } finally {
      setPending(false);
    }
  }

  async function confirmDisable() {
    setPending(true);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, totp: disableCode }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        toast({ variant: "destructive", title: "Couldn't disable", description: json?.message });
        return;
      }
      toast({ variant: "success", title: "2FA disabled" });
      setEnabled(false);
      setStep("idle");
      setPassword("");
      setDisableCode("");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            <CardTitle>Two-factor authentication</CardTitle>
          </div>
          <Badge variant={enabled ? "success" : "outline"}>{enabled ? "Enabled" : "Disabled"}</Badge>
        </div>
        <CardDescription>
          Add a second factor (TOTP from Google Authenticator, 1Password, Authy,
          etc.) so a stolen password isn&apos;t enough to access your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "idle" && !enabled && (
          <Button type="button" variant="accent" onClick={startSetup} disabled={pending}>
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Enable 2FA
          </Button>
        )}

        {step === "idle" && enabled && (
          <Button type="button" variant="destructive" onClick={() => setStep("disable")}>
            <ShieldOff className="mr-2 size-4" />
            Disable 2FA
          </Button>
        )}

        {step === "scan" && setup && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR with your authenticator app, then enter the 6-digit
              code it generates.
            </p>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="overflow-hidden rounded-lg border bg-white p-2">
                <Image
                  src={setup.qrDataUrl}
                  alt="2FA setup QR"
                  width={192}
                  height={192}
                  unoptimized
                />
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Manual entry
                  </div>
                  <code className="select-all break-all rounded bg-muted px-2 py-1 font-mono">
                    {setup.secret}
                  </code>
                </div>
                <div className="text-xs text-muted-foreground">
                  Issuer: <span className="font-medium">{setup.issuer}</span> · Account:{" "}
                  <span className="font-medium">{setup.account}</span>
                </div>
              </div>
            </div>
            <Button type="button" variant="accent" onClick={() => setStep("verify")}>
              Continue
            </Button>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-3">
            <Label htmlFor="totp-code">6-digit code</Label>
            <Input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="123 456"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="accent"
                onClick={confirmEnable}
                disabled={pending || code.length < 6}
              >
                {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Verify & enable
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep("scan")}>
                Back
              </Button>
            </div>
          </div>
        )}

        {step === "show-codes" && (
          <RecoveryCodesCard
            codes={recoveryCodes}
            onAcknowledge={() => {
              setStep("idle");
              setRecoveryCodes([]);
            }}
          />
        )}

        {step === "disable" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Confirm your password and a current TOTP code to disable 2FA.
            </p>
            <div className="space-y-2">
              <Label htmlFor="disable-password">Password</Label>
              <Input
                id="disable-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disable-code">Current 6-digit code</Label>
              <Input
                id="disable-code"
                inputMode="numeric"
                maxLength={8}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={confirmDisable}
                disabled={pending || !password || disableCode.length < 6}
              >
                {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Confirm disable
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep("idle")}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
