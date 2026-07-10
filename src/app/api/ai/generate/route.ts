import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const bodySchema = z.object({
  kind: z.enum(["bio", "theme", "cta", "seo", "username"]),
  prompt: z.string().min(1).max(500),
  context: z.record(z.unknown()).optional(),
});

const FALLBACKS: Record<z.infer<typeof bodySchema>["kind"], (prompt: string) => unknown> = {
  bio: (prompt) => ({
    variants: [
      `Creator · ${prompt}. Building in public and shipping weekly.`,
      `${prompt} — links, drops and the occasional hot take.`,
      `Hi, I'm into ${prompt}. Tap a link below to connect.`,
    ],
  }),
  theme: (prompt) => {
    const mood = prompt.toLowerCase();
    if (mood.includes("dark") || mood.includes("neon")) {
      return {
        tokens: {
          background: "#0B0B12",
          surface: "#161622",
          text: "#F5F5F7",
          accent: "#A78BFA",
          radius: 18,
        },
        rationale: "Dark neon palette for high-contrast CTAs.",
      };
    }
    if (mood.includes("warm") || mood.includes("sunset")) {
      return {
        tokens: {
          background: "#FFF7ED",
          surface: "#FFFFFF",
          text: "#1C1917",
          accent: "#EA580C",
          radius: 14,
        },
        rationale: "Warm sunset tones that feel approachable.",
      };
    }
    return {
      tokens: {
        background: "#F8FAFC",
        surface: "#FFFFFF",
        text: "#0F172A",
        accent: "#7C3AED",
        radius: 16,
      },
      rationale: "Clean minimal palette with a purple accent.",
    };
  },
  cta: (prompt) => ({
    variants: [
      `Get ${prompt} now`,
      `Start free — ${prompt}`,
      `Join others using ${prompt}`,
      `Claim your spot`,
    ],
  }),
  seo: (prompt) => ({
    title: `${prompt} | Official links`,
    description: `All official links for ${prompt}: socials, shop, booking and more in one place.`,
    keywords: [prompt, "links", "bio", "official"],
  }),
  username: (prompt) => {
    const base = prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 16) || "creator";
    return {
      suggestions: [
        base,
        `${base}hq`,
        `hey${base}`,
        `${base}links`,
        `the${base}`,
        `${base}official`,
      ].map((s) => s.slice(0, 32)),
    };
  },
};

async function callOpenAI(kind: string, prompt: string): Promise<unknown | null> {
  if (!env.OPENAI_API_KEY) return null;

  const system = `You are Linkforge AI. Return strict JSON only for kind=${kind}. No markdown.`;
  const user = `Generate ${kind} suggestions for: ${prompt}`;

  try {
    const res = await fetch(`${env.OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "ai.openai.failed");
      return null;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as unknown;
  } catch (err) {
    logger.warn({ err }, "ai.openai.error");
    return null;
  }
}

export async function POST(req: Request) {
  if (!env.FEATURE_AI) return errors.forbidden("AI features are disabled");

  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const rl = await rateLimit(`ai:generate:${session.user.id}`, 20, 10);
  if (!rl.ok) return errors.tooMany();

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid input", parsed.error.flatten().fieldErrors);

  const { kind, prompt } = parsed.data;
  const remote = await callOpenAI(kind, prompt);
  const data = remote ?? FALLBACKS[kind](prompt);

  return ok({ kind, source: remote ? "openai" : "fallback", result: data });
}
