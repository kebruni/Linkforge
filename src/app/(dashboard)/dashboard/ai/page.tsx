import { Sparkles } from "lucide-react";
import { env } from "@/lib/env";
import { AiStudio } from "@/features/ai/ai-studio";

export const metadata = { title: "AI co-pilot" };

export default function AiPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <Sparkles className="size-6 text-accent" />
          AI co-pilot
        </h1>
        <p className="mt-1 text-muted-foreground">
          Bio, theme, CTA, SEO and username suggestions — works offline with fallbacks, or via your
          OpenAI-compatible API key.
        </p>
      </div>
      <AiStudio enabled={env.FEATURE_AI} />
    </div>
  );
}
