"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";

type Kind = "bio" | "theme" | "cta" | "seo" | "username";

const TOOLS: { kind: Kind; title: string; description: string; placeholder: string }[] = [
  {
    kind: "bio",
    title: "Bio generator",
    description: "Three on-brand bio variants for your header.",
    placeholder: "indie game designer who ships weekly",
  },
  {
    kind: "theme",
    title: "Theme generator",
    description: "Color tokens from a single mood prompt.",
    placeholder: "dark neon cyberpunk",
  },
  {
    kind: "cta",
    title: "CTA optimiser",
    description: "Short call-to-action lines that convert.",
    placeholder: "free design critique calls",
  },
  {
    kind: "seo",
    title: "SEO audit",
    description: "Title, description and keyword suggestions.",
    placeholder: "Maya — product designer in Berlin",
  },
  {
    kind: "username",
    title: "Username ideas",
    description: "Slug-safe handle suggestions.",
    placeholder: "Maya Rivera",
  },
];

export function AiStudio({ enabled }: { enabled: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [active, setActive] = useState<Kind>("bio");
  const [result, setResult] = useState<unknown>(null);
  const [source, setSource] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(kind: Kind) {
    if (!enabled) {
      toast({ variant: "destructive", title: "AI is disabled", description: "Set FEATURE_AI=true." });
      return;
    }
    if (!prompt.trim()) {
      toast({ variant: "destructive", title: "Add a prompt first" });
      return;
    }
    setActive(kind);
    startTransition(async () => {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, prompt: prompt.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        toast({
          variant: "destructive",
          title: "Generation failed",
          description: json?.message ?? "Try again.",
        });
        return;
      }
      setResult(json.data.result);
      setSource(json.data.source);
    });
  }

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI co-pilot is off</CardTitle>
          <CardDescription>
            Enable with <code>FEATURE_AI=true</code> in your environment. Generators work offline with
            smart fallbacks; set <code>OPENAI_API_KEY</code> for full model quality.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="ai-prompt">Describe yourself or the mood</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="ai-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={TOOLS.find((t) => t.kind === active)?.placeholder}
            className="flex-1"
          />
          <Button variant="accent" onClick={() => run(active)} disabled={pending}>
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            Generate
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TOOLS.map((t) => (
          <Card
            key={t.kind}
            className={active === t.kind ? "border-accent shadow-sm" : undefined}
          >
            <CardHeader>
              <CardTitle className="text-base">{t.title}</CardTitle>
              <CardDescription>{t.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant={active === t.kind ? "accent" : "outline"}
                size="sm"
                onClick={() => {
                  setActive(t.kind);
                  run(t.kind);
                }}
                disabled={pending}
              >
                Run
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {result != null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              Result
              {source ? (
                <span className="text-xs font-normal text-muted-foreground">source: {source}</span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
