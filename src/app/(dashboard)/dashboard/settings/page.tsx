import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { isBillingConfigured } from "@/lib/stripe";
import { ProfileForm } from "@/features/settings/profile-form";
import { SecurityForm } from "@/features/settings/security-form";
import { BillingForm } from "@/features/settings/billing-form";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Account, security, billing.</p>
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
          <CardDescription>Upgrade to PRO for unlimited pages, AI and custom domains.</CardDescription>
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

      <p className="text-xs text-muted-foreground">
        App: {env.APP_NAME} · {env.APP_URL}
      </p>
    </div>
  );
}
