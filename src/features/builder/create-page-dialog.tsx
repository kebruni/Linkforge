"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { slugify } from "@/lib/utils";

export function CreatePageDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setSlug("");
      setSlugTouched(false);
      setFieldError(null);
      setPending(false);
    }
  }, [open]);

  function onTitleChange(value: string) {
    setTitle(value);
    setFieldError(null);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  function onSlugChange(value: string) {
    setSlugTouched(true);
    setFieldError(null);
    // Live-normalize so users never fight the pattern
    setSlug(slugify(value));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);

    const cleanTitle = title.trim();
    const cleanSlug = slugify(slug || title);

    if (!cleanTitle) {
      setFieldError("Enter a title for your page.");
      return;
    }
    if (cleanSlug.length < 3) {
      setFieldError("Slug must be at least 3 characters (a–z, 0–9, hyphens).");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: cleanTitle, slug: cleanSlug }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const details = json?.details as Record<string, string[] | undefined> | undefined;
        const fromZod =
          details?.slug?.[0] ?? details?.title?.[0] ?? null;
        const message = json?.message ?? fromZod ?? "Try a different slug.";
        setFieldError(message);
        toast({
          variant: "destructive",
          title: "Couldn't create page",
          description: message,
        });
        return;
      }
      setOpen(false);
      router.push(`/dashboard/pages/${json.data.id}/edit`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent">
          <Plus className="mr-1 size-4" />
          New page
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create page</DialogTitle>
          <DialogDescription>
            Pick a title and a public URL slug. You can change both later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="page-title">Title</Label>
            <Input
              id="page-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="My link page"
              required
              maxLength={160}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">Any name is fine — including apostrophes.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-slug">Slug</Label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
                /u/
              </span>
              <Input
                id="page-slug"
                className="rounded-l-none"
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                placeholder="my-page"
                required
                minLength={3}
                maxLength={32}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Letters, numbers and hyphens only. Auto-filled from the title.
            </p>
          </div>
          {fieldError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {fieldError}
            </p>
          ) : null}
          <Button type="submit" className="w-full" variant="accent" disabled={pending || !title.trim()}>
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create page
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
