import { Suspense } from "react";
import { TwoFactorForm } from "@/features/auth/two-factor-form";

export const metadata = { title: "Two-factor authentication" };

export default function TwoFactorPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Two-factor check</h1>
        <p className="text-sm text-muted-foreground">
          Your account is protected with an authenticator app.
        </p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted/50" />}>
        <TwoFactorForm />
      </Suspense>
    </div>
  );
}
