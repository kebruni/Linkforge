"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Loader2, Plus, QrCode, Save, Trash2 } from "lucide-react";
import type { BlockType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { BLOCK_PALETTE, type BlockKind } from "@/features/builder/blocks";
import { LivePreview } from "@/features/builder/live-preview";
import { DomainPanel } from "@/features/builder/domain-panel";

type EditorBlock = {
  id: string;
  type: BlockType;
  order: number;
  hidden: boolean;
  label: string | null;
  url: string | null;
  content: Record<string, unknown>;
};

type ThemeTokens = {
  background: string;
  surface: string;
  text: string;
  accent: string;
  radius: number;
};

type EditorPage = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  blocks: EditorBlock[];
  theme: { tokens: Record<string, unknown> } | null;
};

const DEFAULT_THEME: ThemeTokens = {
  background: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#0A0A0A",
  accent: "#7C3AED",
  radius: 16,
};

export function PageBuilder({ page }: { page: EditorPage }) {
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [description, setDescription] = useState(page.description ?? "");
  const [isPublished, setIsPublished] = useState(page.isPublished);
  const [blocks, setBlocks] = useState<EditorBlock[]>(page.blocks);
  const [theme, setTheme] = useState<ThemeTokens>(() => ({
    ...DEFAULT_THEME,
    ...(page.theme?.tokens as Partial<ThemeTokens> | undefined),
  }));
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      const next = arrayMove(items, oldIndex, newIndex).map((b, i) => ({ ...b, order: i }));
      void persistOrder(next.map((b) => b.id));
      return next;
    });
  }

  async function persistOrder(orderedIds: string[]) {
    await fetch(`/api/pages/${page.id}/blocks/reorder`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
  }

  async function addBlock(kind: BlockKind) {
    const res = await fetch(`/api/pages/${page.id}/blocks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: kind }),
    });
    const json = await res.json();
    if (!res.ok || json.ok === false) {
      toast({ variant: "destructive", title: "Couldn't add block", description: json?.message ?? "Try again." });
      return;
    }
    setBlocks((b) => [...b, json.data]);
  }

  async function updateBlock(id: string, patch: Partial<EditorBlock>) {
    setBlocks((all) => all.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    await fetch(`/api/pages/${page.id}/blocks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function deleteBlock(id: string) {
    setBlocks((all) => all.filter((b) => b.id !== id));
    await fetch(`/api/pages/${page.id}/blocks/${id}`, { method: "DELETE" });
  }

  function savePage() {
    startTransition(async () => {
      const [pageRes, themeRes] = await Promise.all([
        fetch(`/api/pages/${page.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, description, isPublished }),
        }),
        fetch(`/api/pages/${page.id}/theme`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tokens: theme }),
        }),
      ]);
      const pageJson = await pageRes.json();
      if (!pageRes.ok || pageJson.ok === false) {
        toast({ variant: "destructive", title: "Save failed", description: pageJson?.message ?? "" });
        return;
      }
      if (!themeRes.ok) {
        toast({ variant: "destructive", title: "Theme save failed" });
        return;
      }
      toast({ variant: "success", title: "Saved" });
      router.refresh();
    });
  }

  async function loadQr() {
    try {
      const res = await fetch(`/api/pages/${page.id}/qr`);
      const json = await res.json();
      if (res.ok && json.ok && json.data?.dataUrl) {
        setQrDataUrl(json.data.dataUrl);
      } else {
        toast({ variant: "destructive", title: "Couldn't generate QR" });
      }
    } catch {
      toast({ variant: "destructive", title: "Couldn't generate QR" });
    }
  }

  // Persist title/description automatically (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      void fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
    }, 600);
    return () => clearTimeout(id);
  }, [title, description, page.id]);

  // Persist theme tokens (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      void fetch(`/api/pages/${page.id}/theme`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokens: theme }),
      });
    }, 500);
    return () => clearTimeout(id);
  }, [theme, page.id]);

  const previewPage = {
    id: page.id,
    slug: page.slug,
    title,
    description,
    isPublished,
    ogImageUrl: null,
    faviconUrl: null,
    metaJson: null,
    blocks: blocks.map((b) => ({ ...b, content: b.content })),
    theme: { tokens: theme as unknown as Record<string, unknown> },
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <Input
              className="border-0 px-0 text-xl font-semibold focus-visible:ring-0 sm:text-2xl"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="truncate text-xs text-muted-foreground">/u/{page.slug}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
              <Switch checked={isPublished} onCheckedChange={setIsPublished} id="publish" />
              <Label htmlFor="publish" className="text-sm">
                Publish
              </Label>
            </div>
            <Button onClick={savePage} variant="accent" disabled={pending} className="flex-1 sm:flex-none">
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Save
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-3">
                  {blocks.map((b) => (
                    <SortableBlockRow key={b.id} block={b} onChange={updateBlock} onDelete={deleteBlock} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add block</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {BLOCK_PALETTE.map((p) => (
                <Button key={p.kind} variant="outline" onClick={() => addBlock(p.kind)} className="justify-start">
                  <Plus className="mr-2 size-4" />
                  {p.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["background", "Background"],
                ["surface", "Surface"],
                ["text", "Text"],
                ["accent", "Accent"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`theme-${key}`}>{label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    id={`theme-${key}`}
                    type="color"
                    className="h-10 w-12 cursor-pointer rounded border bg-transparent p-1"
                    value={theme[key]}
                    onChange={(e) => setTheme((t) => ({ ...t, [key]: e.target.value }))}
                  />
                  <Input
                    value={theme[key]}
                    onChange={(e) => setTheme((t) => ({ ...t, [key]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="theme-radius">Corner radius ({theme.radius}px)</Label>
              <input
                id="theme-radius"
                type="range"
                min={0}
                max={32}
                value={theme.radius}
                onChange={(e) => setTheme((t) => ({ ...t, radius: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SEO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this page is about — used in OpenGraph & Twitter cards."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custom domain</CardTitle>
          </CardHeader>
          <CardContent>
            <DomainPanel pageId={page.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="size-4" />
              QR code
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`QR for /u/${page.slug}`} className="size-36 rounded-md border bg-white p-2" />
            ) : (
              <div className="grid size-36 place-items-center rounded-md border border-dashed text-xs text-muted-foreground">
                Not generated
              </div>
            )}
            <div className="space-y-2">
              <Button type="button" variant="outline" onClick={loadQr}>
                Generate QR
              </Button>
              {qrDataUrl ? (
                <a href={qrDataUrl} download={`linkforge-${page.slug}.png`} className="block text-sm text-accent underline">
                  Download PNG
                </a>
              ) : null}
              <p className="text-xs text-muted-foreground">Points to your public page URL.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="order-first xl:order-none xl:sticky xl:top-20">
        <Tabs defaultValue="mobile" className="space-y-3">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="mobile" className="flex-1 sm:flex-none">
              Mobile
            </TabsTrigger>
            <TabsTrigger value="desktop" className="flex-1 sm:flex-none">
              Desktop
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mobile">
            <LivePreview page={previewPage} width={380} />
          </TabsContent>
          <TabsContent value="desktop">
            <LivePreview page={previewPage} width={760} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SortableBlockRow({
  block,
  onChange,
  onDelete,
}: {
  block: EditorBlock;
  onChange: (id: string, patch: Partial<EditorBlock>) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function patchContent(partial: Record<string, unknown>) {
    const next = { ...block.content, ...partial };
    const extra: Partial<EditorBlock> = { content: next };
    if (typeof partial.label === "string") extra.label = partial.label;
    if (typeof partial.url === "string") extra.url = partial.url;
    if (typeof partial.src === "string" && block.type === "IMAGE") {
      // keep url for convenience
    }
    onChange(block.id, extra);
  }

  return (
    <li ref={setNodeRef} style={style} className="rounded-md border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          aria-label="Drag block"
          className="cursor-grab text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{block.type}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Toggle visibility"
            onClick={() => onChange(block.id, { hidden: !block.hidden })}
          >
            {block.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <Button size="icon" variant="ghost" aria-label="Delete block" onClick={() => onDelete(block.id)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <BlockInspector block={block} onContent={patchContent} onChange={onChange} />
    </li>
  );
}

function BlockInspector({
  block,
  onContent,
  onChange,
}: {
  block: EditorBlock;
  onContent: (partial: Record<string, unknown>) => void;
  onChange: (id: string, patch: Partial<EditorBlock>) => void;
}) {
  const c = block.content;

  switch (block.type) {
    case "HEADER":
      return (
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={str(c.title)}
            onChange={(e) => onContent({ title: e.target.value })}
            placeholder="Title"
          />
          <Input
            value={str(c.subtitle)}
            onChange={(e) => onContent({ subtitle: e.target.value })}
            placeholder="Subtitle"
          />
        </div>
      );
    case "AVATAR":
      return (
        <Input
          value={str(c.src)}
          onChange={(e) => onContent({ src: e.target.value || null })}
          placeholder="https://…/avatar.jpg"
        />
      );
    case "LINK":
    case "BUTTON":
      return (
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={block.label ?? str(c.label)}
            onChange={(e) => {
              const v = e.target.value;
              onChange(block.id, { label: v, content: { ...c, label: v } });
            }}
            placeholder="Label"
          />
          <Input
            value={block.url ?? str(c.url)}
            onChange={(e) => {
              const v = e.target.value;
              onChange(block.id, { url: v, content: { ...c, url: v } });
            }}
            placeholder="https://example.com"
          />
        </div>
      );
    case "TEXT":
      return (
        <Textarea
          value={str(c.text)}
          onChange={(e) => onContent({ text: e.target.value })}
          placeholder="Write something…"
          rows={3}
        />
      );
    case "IMAGE":
      return (
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={str(c.src)}
            onChange={(e) => onContent({ src: e.target.value })}
            placeholder="Image URL"
          />
          <Input
            value={str(c.alt)}
            onChange={(e) => onContent({ alt: e.target.value })}
            placeholder="Alt text"
          />
        </div>
      );
    case "EMBED":
    case "VIDEO":
      return (
        <Input
          value={block.url ?? str(c.url)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(block.id, { url: v, content: { ...c, url: v } });
          }}
          placeholder="YouTube / TikTok / Spotify URL"
        />
      );
    case "FAQ":
      return (
        <Textarea
          value={JSON.stringify(c.items ?? [{ q: "Question", a: "Answer" }], null, 2)}
          onChange={(e) => {
            try {
              const items = JSON.parse(e.target.value) as unknown;
              if (Array.isArray(items)) onContent({ items });
            } catch {
              /* ignore while typing */
            }
          }}
          rows={5}
          className="font-mono text-xs"
        />
      );
    case "COUNTDOWN":
      return (
        <Input
          type="datetime-local"
          value={toLocalInput(str(c.targetAt))}
          onChange={(e) => {
            const d = new Date(e.target.value);
            if (!Number.isNaN(d.getTime())) onContent({ targetAt: d.toISOString() });
          }}
        />
      );
    case "GALLERY":
      return (
        <Textarea
          value={Array.isArray(c.images) ? (c.images as string[]).join("\n") : ""}
          onChange={(e) =>
            onContent({
              images: e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="One image URL per line"
          rows={3}
        />
      );
    case "MAP":
      return (
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={str(c.query)}
            onChange={(e) => onContent({ query: e.target.value })}
            placeholder="City or address"
          />
          <Input
            type="number"
            min={1}
            max={20}
            value={typeof c.zoom === "number" ? c.zoom : 13}
            onChange={(e) => onContent({ zoom: Number(e.target.value) || 13 })}
            placeholder="Zoom"
          />
        </div>
      );
    case "FORM":
      return (
        <div className="grid gap-2">
          <Input
            value={str(c.title)}
            onChange={(e) => onContent({ title: e.target.value })}
            placeholder="Form title"
          />
          <Input
            value={str(c.submitLabel) || "Send"}
            onChange={(e) => onContent({ submitLabel: e.target.value })}
            placeholder="Submit label"
          />
        </div>
      );
    case "DONATION":
      return (
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={str(c.title)}
            onChange={(e) => onContent({ title: e.target.value })}
            placeholder="Title"
          />
          <Input
            value={Array.isArray(c.amounts) ? (c.amounts as number[]).join(",") : "3,5,10"}
            onChange={(e) =>
              onContent({
                amounts: e.target.value
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => n > 0),
              })
            }
            placeholder="3,5,10"
          />
        </div>
      );
    case "PRODUCT":
      return (
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={str(c.title)}
            onChange={(e) => onContent({ title: e.target.value })}
            placeholder="Product name"
          />
          <Input
            type="number"
            value={typeof c.priceMinor === "number" ? c.priceMinor : 1000}
            onChange={(e) => onContent({ priceMinor: Number(e.target.value) || 0 })}
            placeholder="Price (cents)"
          />
          <Input
            className="md:col-span-2"
            value={str(c.description)}
            onChange={(e) => onContent({ description: e.target.value })}
            placeholder="Description"
          />
        </div>
      );
    case "SOCIAL":
      return (
        <Textarea
          value={
            Array.isArray(c.items)
              ? (c.items as { kind: string; href: string }[])
                  .map((i) => `${i.kind}|${i.href}`)
                  .join("\n")
              : ""
          }
          onChange={(e) => {
            const items = e.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const [kind, ...rest] = line.split("|");
                return { kind: (kind || "twitter").trim(), href: rest.join("|").trim() };
              });
            onContent({ items });
          }}
          placeholder={"twitter|https://x.com/you\ngithub|https://github.com/you"}
          rows={3}
          className="font-mono text-xs"
        />
      );
    default:
      return (
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={block.label ?? str(c.label)}
            onChange={(e) => {
              const v = e.target.value;
              onChange(block.id, { label: v, content: { ...c, label: v } });
            }}
            placeholder={`${block.type.toLowerCase()} label`}
          />
          <Input
            value={block.url ?? str(c.url)}
            onChange={(e) => {
              const v = e.target.value;
              onChange(block.id, { url: v, content: { ...c, url: v } });
            }}
            placeholder="https://example.com"
          />
        </div>
      );
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
