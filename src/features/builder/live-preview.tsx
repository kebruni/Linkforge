"use client";

import type { BlockType } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LinkBlock } from "@/components/public/blocks/link-block";
import { TextBlock } from "@/components/public/blocks/text-block";
import { ButtonBlock } from "@/components/public/blocks/button-block";
import { ImageBlock } from "@/components/public/blocks/image-block";
import { EmbedBlock } from "@/components/public/blocks/embed-block";
import { SocialBlock } from "@/components/public/blocks/social-block";
import { DividerBlock } from "@/components/public/blocks/divider-block";
import { HeaderBlock } from "@/components/public/blocks/header-block";
import { FaqBlock } from "@/components/public/blocks/faq-block";
import { GalleryBlock } from "@/components/public/blocks/gallery-block";
import { CountdownBlock } from "@/components/public/blocks/countdown-block";
import { FormBlock } from "@/components/public/blocks/form-block";
import { MapBlock } from "@/components/public/blocks/map-block";
import { DonationBlock } from "@/components/public/blocks/donation-block";
import { ProductBlock } from "@/components/public/blocks/product-block";

interface LivePage {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  ogImageUrl: string | null;
  faviconUrl: string | null;
  metaJson: unknown;
  blocks: {
    id: string;
    type: BlockType;
    order: number;
    hidden: boolean;
    label: string | null;
    url: string | null;
    content: Record<string, unknown>;
  }[];
  theme: { tokens: Record<string, unknown> } | null;
}

export function LivePreview({ page, width }: { page: LivePage; width: number }) {
  const tokens = (page.theme?.tokens as Record<string, string | number> | undefined) ?? {};
  const cssVars: React.CSSProperties = {
    ["--lf-bg" as string]: (tokens.background as string) ?? "#FAFAFA",
    ["--lf-surface" as string]: (tokens.surface as string) ?? "#FFFFFF",
    ["--lf-text" as string]: (tokens.text as string) ?? "#0A0A0A",
    ["--lf-accent" as string]: (tokens.accent as string) ?? "#7C3AED",
    ["--lf-radius" as string]: `${tokens.radius ?? 16}px`,
    background: "var(--lf-bg)",
    color: "var(--lf-text)",
  };
  const visible = page.blocks.filter((b) => !b.hidden).sort((a, b) => a.order - b.order);

  return (
    <div className="overflow-hidden rounded-2xl border shadow-sm">
      <div
        className="flex min-h-[640px] flex-col gap-3 px-6 py-10"
        style={{ ...cssVars, width: "100%", maxWidth: width }}
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
          {visible.map((b) => {
            switch (b.type) {
              case "HEADER":
                return <HeaderBlock key={b.id} data={b.content} />;
              case "AVATAR":
                return <AvatarPreview key={b.id} data={b.content} />;
              case "LINK":
                return (
                  <LinkBlock key={b.id} id={b.id} data={b.content} label={b.label} url={b.url} isEditing />
                );
              case "BUTTON":
                return <ButtonBlock key={b.id} id={b.id} data={b.content} isEditing />;
              case "TEXT":
                return <TextBlock key={b.id} data={b.content} />;
              case "IMAGE":
                return <ImageBlock key={b.id} data={b.content} />;
              case "VIDEO":
              case "EMBED":
                return <EmbedBlock key={b.id} data={b.content} />;
              case "SOCIAL":
                return <SocialBlock key={b.id} id={b.id} data={b.content} isEditing />;
              case "DIVIDER":
                return <DividerBlock key={b.id} data={b.content} />;
              case "FAQ":
                return <FaqBlock key={b.id} data={b.content} />;
              case "GALLERY":
                return <GalleryBlock key={b.id} data={b.content} />;
              case "COUNTDOWN":
                return <CountdownBlock key={b.id} data={b.content} />;
              case "FORM":
                return (
                  <FormBlock key={b.id} pageId={page.id} blockId={b.id} data={b.content} isEditing />
                );
              case "MAP":
                return <MapBlock key={b.id} data={b.content} />;
              case "DONATION":
                return <DonationBlock key={b.id} data={b.content} isEditing />;
              case "PRODUCT":
                return <ProductBlock key={b.id} data={b.content} isEditing />;
              default:
                return (
                  <div
                    key={b.id}
                    className="rounded-md border border-dashed border-current/20 p-3 text-center text-xs opacity-60"
                  >
                    {b.type}
                  </div>
                );
            }
          })}
          {visible.length === 0 && (
            <div className="rounded-2xl border border-dashed border-current/20 p-10 text-center text-sm opacity-70">
              Add some blocks to see them appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AvatarPreview({ data }: { data: Record<string, unknown> }) {
  const src = typeof data.src === "string" ? data.src : null;
  return (
    <div className="flex justify-center pt-4">
      <Avatar className="size-20 ring-2 ring-current/10">
        <AvatarImage src={src ?? undefined} alt="avatar" />
        <AvatarFallback>L</AvatarFallback>
      </Avatar>
    </div>
  );
}
