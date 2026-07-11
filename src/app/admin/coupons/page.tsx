import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CouponsPanel } from "@/features/admin/coupons-panel";

export const metadata = { title: "Coupons · Admin" };

export default function AdminCouponsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Coupons</h1>
        <p className="mt-1 text-muted-foreground">First-party promo codes applied at PRO checkout.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Promo codes</CardTitle>
          <CardDescription>Percent-off coupons for subscription checkout.</CardDescription>
        </CardHeader>
        <CardContent>
          <CouponsPanel />
        </CardContent>
      </Card>
    </div>
  );
}
