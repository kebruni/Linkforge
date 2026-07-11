import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { isBillingConfigured } from "@/lib/stripe";
import { isProRole } from "@/lib/plan";
import { ProfileForm } from "@/features/settings/profile-form";
import { SecurityForm } from "@/features/settings/security-form";
import { BillingForm } from "@/features/settings/billing-form";
import { SessionsPanel } from "@/features/settings/sessions-panel";
import { ApiKeysPanel } from "@/features/settings/api-keys-panel";
import { WebhooksPanel } from "@/features/settings/webhooks-panel";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      username: true,
      name: true,
      role: true,
      twoFactorEnabled: true,
      marketingOptIn: true,
      referralCode: true,
      createdAt: true,
      subscription: {
        select: {
          status: true,
          plan: true,
          currentPeriodEnd: true,
        },
      },
    },
  });

  if (!user) return null;

  const isPro = isProRole(user.role);
  const referralUrl = `${env.APP_URL.replace(/\/$/, "")}/register?ref=${user.referralCode}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Account, security, billing, and developer tools.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Public name and username used across Linkforge.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              name: user.name ?? user.username,
              username: user.username,
              email: user.email,
              marketingOptIn: user.marketingOptIn,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan & billing</CardTitle>
          <CardDescription>
            Upgrade to PRO for unlimited pages, API keys, webhooks, and custom domains.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BillingForm
            role={user.role}
            billingEnabled={isBillingConfigured()}
            subscription={
              user.subscription
                ? {
                    status: user.subscription.status,
                    plan: user.subscription.plan,
                    currentPeriodEnd: user.subscription.currentPeriodEnd?.toISOString() ?? null,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Password, two-factor authentication, recovery codes.</CardDescription>
        </CardHeader>
        <CardContent>
          <SecurityForm twoFactorEnabled={user.twoFactorEnabled} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Devices & sessions</CardTitle>
          <CardDescription>Review and revoke sign-ins on other devices.</CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsPanel />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>Machine access for integrations (PRO).</CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeysPanel isPro={isPro} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>
            Receive signed HTTPS callbacks for form submits, publishes, and purchases (PRO).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhooksPanel isPro={isPro} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referral</CardTitle>
          <CardDescription>Share Linkforge — your code is tracked on signup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Your code: <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{user.referralCode}</code>
          </p>
          <p className="break-all text-muted-foreground">{referralUrl}</p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        App: {env.APP_NAME} · {env.APP_URL}
      </p>
    </div>
  );
}
