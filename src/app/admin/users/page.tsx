import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { UserActions } from "@/features/admin/user-actions";

export const metadata = { title: "Users · Admin" };

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      createdAt: true,
      lastSeenAt: true,
      deletedAt: true,
      _count: { select: { pages: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-muted-foreground">Latest 100 accounts — promote, demote, or suspend.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>Soft-suspend sets deletedAt; login is blocked while suspended.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Pages</th>
                <th className="py-2 pr-4 font-medium">Joined</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className={u.deletedAt ? "opacity-60" : undefined}>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{u.name ?? u.username}</div>
                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                    {u.deletedAt && (
                      <Badge variant="destructive" className="mt-1">
                        Suspended
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{u.email}</td>
                  <td className="py-3 pr-4">
                    <Badge variant={u.role === "ADMIN" ? "destructive" : u.role === "PRO" ? "accent" : "outline"}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">{u._count.pages}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{u.createdAt.toLocaleDateString()}</td>
                  <td className="py-3">
                    {u.role === "ADMIN" ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <UserActions userId={u.id} role={u.role} suspended={!!u.deletedAt} />
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
