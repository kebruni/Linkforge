import { Suspense } from "react";
import { VerifyEmailClient } from "@/features/auth/verify-email-client";

export const metadata = { title: "Verify email" };

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="h-32 animate-pulse rounded-md bg-muted/50" />}>
      <VerifyEmailClient />
    </Suspense>
  );
}
