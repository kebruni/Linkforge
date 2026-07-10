"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function UserActions({
  userId,
  role,
  suspended,
}: {
  userId: string;
  role: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function patch(body: Record<string, unknown>, success: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        toast({
          variant: "destructive",
          title: "Action failed",
          description: json?.message ?? "Try again.",
        });
        return;
      }
      toast({ variant: "success", title: success });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-1">
      {role !== "PRO" && role !== "ADMIN" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => patch({ role: "PRO" }, "Promoted to PRO")}
        >
          Make PRO
        </Button>
      )}
      {role === "PRO" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => patch({ role: "USER" }, "Demoted to USER")}
        >
          Make USER
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant={suspended ? "outline" : "destructive"}
        disabled={pending}
        onClick={() =>
          patch(
            { suspended: !suspended },
            suspended ? "User restored" : "User suspended",
          )
        }
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : suspended ? "Restore" : "Suspend"}
      </Button>
    </div>
  );
}
