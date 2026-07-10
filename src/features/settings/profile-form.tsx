"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";

export function ProfileForm({
  initial,
}: {
  initial: {
    name: string;
    username: string;
    email: string;
    marketingOptIn: boolean;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [username, setUsername] = useState(initial.username);
  const [marketingOptIn, setMarketingOptIn] = useState(initial.marketingOptIn);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, username, marketingOptIn }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        toast({
          variant: "destructive",
          title: "Couldn't save profile",
          description: json?.message ?? "Try again.",
        });
        return;
      }
      toast({ variant: "success", title: "Profile updated" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={64} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
            @
          </span>
          <Input
            id="username"
            className="rounded-l-none"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            required
            minLength={3}
            maxLength={32}
            pattern="[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={initial.email} disabled />
        <p className="text-xs text-muted-foreground">Contact support to change your login email.</p>
      </div>
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <div className="text-sm font-medium">Product updates</div>
          <div className="text-xs text-muted-foreground">Occasional emails about new features.</div>
        </div>
        <Switch checked={marketingOptIn} onCheckedChange={setMarketingOptIn} />
      </div>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Save changes
      </Button>
    </form>
  );
}
