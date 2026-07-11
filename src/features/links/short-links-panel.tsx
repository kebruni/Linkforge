"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Copy, Link2, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

type LinkRow = {
  id: string;
  code: string;
  url: string;
  hits: number;
  shortUrl: string;
  createdAt: string;
};

export function ShortLinksPanel() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const res = await fetch("/api/short-links");
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok) setLinks(json.data.links);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch("/api/short-links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, code: code || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        toast({
          variant: "destructive",
          title: "Could not create link",
          description: json?.message ?? "Try again.",
        });
        return;
      }
      setUrl("");
      setCode("");
      toast({ variant: "success", title: "Short link created" });
      await load();
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/short-links/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Delete failed" });
        return;
      }
      await load();
    });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onCreate}
        className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_160px_auto] sm:p-4"
      >
        <div className="space-y-2">
          <Label htmlFor="url">Destination URL</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://example.com/campaign"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Custom code (optional)</Label>
          <Input
            id="code"
            placeholder="spring"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            pattern="[a-zA-Z0-9_-]{3,32}"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="accent" disabled={pending} className="w-full sm:w-auto">
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Link2 className="mr-2 size-4" />}
            Shorten
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="h-24 animate-pulse rounded-md bg-muted/40" />
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground">No short links yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{l.shortUrl}</div>
                <div className="truncate text-xs text-muted-foreground">{l.url}</div>
              </div>
              <span className="text-xs text-muted-foreground">{l.hits} hits</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Copy"
                onClick={async () => {
                  await navigator.clipboard.writeText(l.shortUrl);
                  toast({ title: "Copied" });
                }}
              >
                <Copy className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Delete"
                onClick={() => onDelete(l.id)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
