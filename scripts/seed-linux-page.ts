import { PrismaClient, BlockType } from "@prisma/client";

const prisma = new PrismaClient();

const USER_ID = "cmrfg5mx20000tl8c026bc70d";
const SLUG = "linux";

async function main() {
  // Remove previous demo if re-run
  const old = await prisma.page.findUnique({ where: { slug: SLUG } });
  if (old) {
    await prisma.block.deleteMany({ where: { pageId: old.id } });
    await prisma.theme.deleteMany({ where: { pageId: old.id } });
    await prisma.page.delete({ where: { id: old.id } });
  }

  const targetAt = new Date();
  targetAt.setDate(targetAt.getDate() + 42); // Kernel-ish countdown

  const page = await prisma.page.create({
    data: {
      userId: USER_ID,
      slug: SLUG,
      title: "Linux Desk · @sigma",
      description:
        "Terminal vibes, FOSS picks, kernel news and a contact form — Linkforge demo page for @sigma.",
      isPublished: true,
      publishedAt: new Date(),
      theme: {
        create: {
          presetKey: "neon-night",
          tokens: {
            background: "#0b1220",
            surface: "#111827",
            text: "#e5e7eb",
            accent: "#22c55e",
            radius: 14,
            font: "JetBrains Mono",
          },
        },
      },
      blocks: {
        create: [
          {
            type: BlockType.AVATAR,
            order: 0,
            content: {
              src: "https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=400&h=400&fit=crop",
            },
          },
          {
            type: BlockType.HEADER,
            order: 1,
            content: {
              title: "Linux Desk",
              subtitle: "@sigma · FOSS · kernels · rice",
            },
          },
          {
            type: BlockType.TEXT,
            order: 2,
            content: {
              text: "Hey — this is a demo Linkforge page about Linux. Scroll to see links, embeds, FAQ, countdown, gallery, map, form, donation & product blocks in one mini-landing.",
              align: "center",
            },
          },
          {
            type: BlockType.SOCIAL,
            order: 3,
            label: "Social",
            content: {
              items: [
                { kind: "github", href: "https://github.com/torvalds" },
                { kind: "youtube", href: "https://www.youtube.com/@LinuxJournal" },
                { kind: "twitter", href: "https://x.com/linux" },
                { kind: "email", href: "mailto:hello@example.com" },
              ],
            },
          },
          {
            type: BlockType.DIVIDER,
            order: 4,
            content: { spacing: 12 },
          },
          {
            type: BlockType.LINK,
            order: 5,
            label: "Arch Wiki — start here",
            url: "https://wiki.archlinux.org/",
            content: { label: "Arch Wiki — start here", url: "https://wiki.archlinux.org/", icon: "📖" },
          },
          {
            type: BlockType.LINK,
            order: 6,
            label: "kernel.org — source of truth",
            url: "https://www.kernel.org/",
            content: { label: "kernel.org — source of truth", url: "https://www.kernel.org/", icon: "🐧" },
          },
          {
            type: BlockType.LINK,
            order: 7,
            label: "DistroWatch — pick a distro",
            url: "https://distrowatch.com/",
            content: { label: "DistroWatch — pick a distro", url: "https://distrowatch.com/", icon: "💿" },
          },
          {
            type: BlockType.BUTTON,
            order: 8,
            label: "Try Ubuntu Desktop",
            url: "https://ubuntu.com/download/desktop",
            content: {
              label: "Try Ubuntu Desktop",
              url: "https://ubuntu.com/download/desktop",
              variant: "primary",
            },
          },
          {
            type: BlockType.EMBED,
            order: 9,
            label: "Linux explained (YouTube)",
            url: "https://www.youtube.com/watch?v=Wgi-OfbP2k8",
            content: {
              url: "https://www.youtube.com/watch?v=Wgi-OfbP2k8",
              kind: "youtube",
            },
          },
          {
            type: BlockType.IMAGE,
            order: 10,
            content: {
              src: "https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=800&fit=crop",
              alt: "Laptop terminal with code",
              href: "https://www.linux.org/",
            },
          },
          {
            type: BlockType.GALLERY,
            order: 11,
            content: {
              layout: "grid",
              images: [
                "https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=600&fit=crop",
                "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=600&fit=crop",
                "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&fit=crop",
                "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&fit=crop",
              ],
            },
          },
          {
            type: BlockType.FAQ,
            order: 12,
            content: {
              items: [
                {
                  q: "Which distro should I start with?",
                  a: "Ubuntu or Linux Mint for beginners; Fedora if you want newer packages; Arch if you enjoy building the system yourself.",
                },
                {
                  q: "Do I lose my Windows files?",
                  a: "No — dual-boot or use a live USB first. Always back up before resizing partitions.",
                },
                {
                  q: "What is a desktop environment?",
                  a: "GNOME, KDE Plasma, XFCE, Hyprland… the UI layer on top of the kernel + userspace. Rice it to your taste.",
                },
                {
                  q: "How do I install packages?",
                  a: "apt (Debian/Ubuntu), dnf (Fedora), pacman (Arch), flatpak/snap for sandboxed apps.",
                },
              ],
            },
          },
          {
            type: BlockType.COUNTDOWN,
            order: 13,
            content: {
              targetAt: targetAt.toISOString(),
              finishedText: "Ship it — kernel party time 🎉",
            },
          },
          {
            type: BlockType.MAP,
            order: 14,
            content: {
              query: "Linux Foundation, San Francisco",
              zoom: 12,
            },
          },
          {
            type: BlockType.FORM,
            order: 15,
            content: {
              title: "Ask a Linux question",
              submitLabel: "Send to @sigma",
              fields: [
                { name: "name", label: "Name", type: "text", required: true },
                { name: "email", label: "Email", type: "email", required: true },
                { name: "message", label: "Your question", type: "textarea", required: true },
              ],
            },
          },
          {
            type: BlockType.PRODUCT,
            order: 16,
            label: "Linux stickers pack",
            content: {
              title: "Tux sticker pack",
              priceMinor: 900,
              currency: "USD",
              description: "Vinyl FOSS stickers for your laptop lid. Demo product block (Stripe when billing is on).",
              imageUrl: "https://images.unsplash.com/photo-1614624532983-4ce03382d63d?w=600&fit=crop",
            },
          },
          {
            type: BlockType.DONATION,
            order: 17,
            content: {
              title: "Fuel the rice ☕",
              amounts: [3, 5, 10],
              currency: "USD",
            },
          },
          {
            type: BlockType.TEXT,
            order: 18,
            content: {
              text: "Edit this page in Dashboard → Pages → Linux Desk. Drag blocks, change theme colors, hit Publish.",
              align: "center",
            },
          },
        ],
      },
    },
    select: { id: true, slug: true, title: true },
  });

  // Also polish the user's existing my-names page a bit
  const mine = await prisma.page.findUnique({ where: { slug: "my-names" } });
  if (mine) {
    await prisma.page.update({
      where: { id: mine.id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
        description: "Personal page of @sigma",
      },
    });
    await prisma.theme.upsert({
      where: { pageId: mine.id },
      create: {
        pageId: mine.id,
        presetKey: "minimal-light",
        tokens: {
          background: "#0f172a",
          surface: "#1e293b",
          text: "#f8fafc",
          accent: "#38bdf8",
          radius: 16,
        },
      },
      update: {
        tokens: {
          background: "#0f172a",
          surface: "#1e293b",
          text: "#f8fafc",
          accent: "#38bdf8",
          radius: 16,
        },
      },
    });
  }

  console.log("OK", page);
  console.log("Public URL: http://localhost:3000/u/linux");
  console.log("LAN URL:    http://192.168.0.151:3000/u/linux");
  console.log("Edit:       http://localhost:3000/dashboard/pages/" + page.id + "/edit");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
