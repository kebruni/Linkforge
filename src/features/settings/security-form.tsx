"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

export function SecurityForm({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // 2FA enroll
  const [enrolling, setEnrolling] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  // 2FA disable
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  function changePassword(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        toast({
          variant: "destructive",
          title: "Could not change password",
          description: json?.message ?? "Try again.",
        });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      toast({ variant: "success", title: "Password updated" });
    });
  }

  async function startEnroll() {
    setEnrolling(true);
    const res = await fetch("/api/auth/2fa/enroll", { method: "POST" });
    const json = await res.json().catch(() => null);
    setEnrolling(false);
    if (!res.ok || json?.ok === false) {
      toast({
        variant: "destructive",
        title: "Enrollment failed",
        description: json?.message ?? "Try again.",
      });
      return;
    }
    setQrDataUrl(json.data.qrDataUrl);
    setSecret(json.data.secret);
  }

  function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch("/api/auth/2fa/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: confirmCode }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        toast({
          variant: "destructive",
          title: "Invalid code",
          description: json?.message ?? "Check your authenticator app.",
        });
        return;
      }
      setRecoveryCodes(json.data.recoveryCodes);
      setQrDataUrl(null);
      setSecret(null);
      setConfirmCode("");
      toast({ variant: "success", title: "2FA enabled" });
      router.refresh();
    });
  }

  function disable2fa(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        toast({
          variant: "destructive",
          title: "Could not disable 2FA",
          description: json?.message ?? "Try again.",
        });
        return;
      }
      setDisablePassword("");
      setDisableCode("");
      toast({ variant: "success", title: "2FA disabled" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <form onSubmit={changePassword} className="space-y-3">
        <h3 className="text-sm font-medium">Change password</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Update password
        </Button>
      </form>

      <div className="space-y-3 border-t pt-6">
        <div className="flex items-center gap-2">
          {twoFactorEnabled ? (
            <ShieldCheck className="size-4 text-emerald-500" />
          ) : (
            <ShieldOff className="size-4 text-muted-foreground" />
          )}
          <h3 className="text-sm font-medium">
            Two-factor authentication {twoFactorEnabled ? "(enabled)" : "(off)"}
          </h3>
        </div>

        {recoveryCodes && (
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium">Save these recovery codes — shown once:</p>
            <ul className="grid grid-cols-2 gap-1 font-mono text-xs">
              {recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={async () => {
                await navigator.clipboard.writeText(recoveryCodes.join("\n"));
                toast({ title: "Copied" });
              }}
            >
              <Copy className="mr-2 size-3" />
              Copy codes
            </Button>
          </div>
        )}

        {!twoFactorEnabled && !qrDataUrl && (
          <Button type="button" size="sm" variant="accent" onClick={startEnroll} disabled={enrolling}>
            {enrolling ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Enable 2FA
          </Button>
        )}

        {qrDataUrl && (
          <form onSubmit={confirmEnroll} className="space-y-3 rounded-md border p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="2FA QR code" className="mx-auto size-44" />
            {secret && (
              <p className="text-center font-mono text-xs text-muted-foreground">
                Manual key: {secret}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="confirmCode">Enter code from app</Label>
              <Input
                id="confirmCode"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                placeholder="123456"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              Confirm & enable
            </Button>
          </form>
        )}

        {twoFactorEnabled && (
          <form onSubmit={disable2fa} className="space-y-3 rounded-md border border-destructive/30 p-4">
            <p className="text-xs text-muted-foreground">
              Disable 2FA with your password and a current authenticator (or recovery) code.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="disablePassword">Password</Label>
                <Input
                  id="disablePassword"
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="disableCode">Code</Label>
                <Input
                  id="disableCode"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" size="sm" variant="destructive" disabled={pending}>
              Disable 2FA
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
