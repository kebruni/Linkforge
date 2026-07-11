import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const pageId = "cmrfgue7f0001az1qe600ll66";

function fixUrl(u: string | null | undefined) {
  if (!u) return u ?? null;
  if (u.startsWith("http://localhost:3000")) return u.replace("http://localhost:3000", "") || "/";
  return u;
}

async function main() {
  const blocks = await prisma.block.findMany({ where: { pageId } });
  for (const b of blocks) {
    const c = { ...((b.content ?? {}) as Record<string, unknown>) };
    let changed = false;
    if (typeof c.url === "string") {
      const n = fixUrl(c.url);
      if (n !== c.url) {
        c.url = n;
        changed = true;
      }
    }
    if (typeof c.href === "string") {
      const n = fixUrl(c.href);
      if (n !== c.href) {
        c.href = n;
        changed = true;
      }
    }
    const newUrl = fixUrl(b.url);
    if (newUrl !== b.url) changed = true;
    if (changed) {
      await prisma.block.update({
        where: { id: b.id },
        data: { content: c, url: newUrl },
      });
      console.log("fixed", b.type, b.label, newUrl ?? c.url);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
