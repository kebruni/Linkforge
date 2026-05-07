"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Github, KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
});
type CredsValues = z.infer<typeof credsSchema>;

type Step = "credentials" | "two-factor";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/dashboard";

  const [step, setStep] = useState<Step>("credentials");
  const [pending, setPending] = useState(false);
  const [savedCreds, setSavedCreds] = useState<CredsValues | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CredsValues>({ resolver: zodResolver(credsSchema) });

  async function completeSignIn(
    creds: CredsValues,
    extra?: { totp?: string; recoveryCode?: string },
  ) {
    const res = await signIn("credentials", {
      ...creds,
      ...extra,
      redirect: false,
    });
    if (res?.error) {
      // res.code is set by our custom CredentialsSignin subclasses; older
      // Auth.js betas surface it via res.error which contains the substring.
      const code = (res as { code?: string }).code ?? "";
      const errStr = `${code} ${res.error}`;
      if (/TWO_FACTOR_REQUIRED/.test(errStr)) {
        return { needsTwoFactor: true as const };
      }
      if (/INVALID_TWO_FACTOR/.test(errStr)) {
        return { error: "Code didn't match. Try again." } as const;
      }
      return { error: "Invalid email or password." } as const;
    }
    router.replace(next);
    router.refresh();
    return { ok: true } as const;
  }

  const onSubmitCreds = handleSubmit(async (values) => {
    setPending(true);
    try {
      // 1) Preflight — verify password and learn whether 2FA is required.
      const pre = await fetch("/api/auth/preflight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const preJson = await pre.json();
      if (!pre.ok || preJson.ok === false) {
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: preJson?.message ?? "Invalid email or password.",
        });
        return;
      }
      if (preJson.data.requires2FA) {
        setSavedCreds(values);
        setStep("two-factor");
        return;
      }
      // 2) No 2FA — sign in directly.
      const res = await completeSignIn(values);
      if ("error" in res) {
        toast({ variant: "destructive", title: "Sign in failed", description: res.error });
      }
    } finally {
      setPending(false);
    }
  });

  async function onSubmitTwoFactor() {
    if (!savedCreds) return;
    setPending(true);
    setTwoFactorError(null);
    try {
      const extra = useRecoveryCode
        ? { recoveryCode: twoFactorCode.trim() }
        : { totp: twoFactorCode.replace(/\s/g, "") };
      const res = await completeSignIn(savedCreds, extra);
      if ("ok" in res) return;
      if ("needsTwoFactor" in res) {
        setTwoFactorError("Server still says 2FA is required. Try the code again.");
        return;
      }
      setTwoFactorError(res.error);
    } finally {
      setPending(false);
    }
  }

  if (step === "two-factor") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="size-5" /> Two-factor authentication
          </h2>
          <p className="text-sm text-muted-foreground">
            {useRecoveryCode
              ? "Enter one of your recovery codes."
              : "Enter the 6-digit code from your authenticator app."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="totp">{useRecoveryCode ? "Recovery code" : "Authenticator code"}</Label>
          <Input
            id="totp"
            inputMode={useRecoveryCode ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoFocus
            maxLength={useRecoveryCode ? 32 : 8}
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSubmitTwoFactor();
            }}
          />
          {twoFactorError && <p className="text-xs text-destructive">{twoFactorError}</p>}
        </div>
        <Button
          type="button"
          variant="accent"
          className="w-full"
          onClick={onSubmitTwoFactor}
          disabled={pending || twoFactorCode.trim().length < (useRecoveryCode ? 8 : 6)}
        >
          {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Verify & sign in
        </Button>
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            className="text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              setUseRecoveryCode((v) => !v);
              setTwoFactorCode("");
              setTwoFactorError(null);
            }}
          >
            {useRecoveryCode ? (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3" /> Use authenticator code instead
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <KeyRound className="size-3" /> Use a recovery code instead
              </span>
            )}
          </button>
          <button
            type="button"
            className="text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              setStep("credentials");
              setTwoFactorCode("");
              setSavedCreds(null);
              setTwoFactorError(null);
              setUseRecoveryCode(false);
            }}
          >
            Use a different account
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmitCreds} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={pending} variant="accent">
        {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Sign in
      </Button>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or continue with
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => signIn("google", { callbackUrl: next })}>
          <span className="mr-2">G</span>Google
        </Button>
        <Button type="button" variant="outline" onClick={() => signIn("github", { callbackUrl: next })}>
          <Github className="mr-2 size-4" />
          GitHub
        </Button>
      </div>
    </form>
  );
}
