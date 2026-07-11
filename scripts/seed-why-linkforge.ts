import { PrismaClient, BlockType } from "@prisma/client";

const prisma = new PrismaClient();

// Prefer @sigma (real user); fall back to demo admin
const SLUG = "why-linkforge";

async function main() {
  const owner =
    (await prisma.user.findUnique({ where: { username: "sigma" } })) ??
    (await prisma.user.findFirst({ where: { role: "ADMIN", deletedAt: null } }));

  if (!owner) throw new Error("No owner user found");

  const old = await prisma.page.findUnique({ where: { slug: SLUG } });
  if (old) {
    await prisma.block.deleteMany({ where: { pageId: old.id } });
    await prisma.theme.deleteMany({ where: { pageId: old.id } });
    await prisma.page.delete({ where: { id: old.id } });
  }

  const launch = new Date();
  launch.setDate(launch.getDate() + 14);

  const page = await prisma.page.create({
    data: {
      userId: owner.id,
      slug: SLUG,
      title: "Почему вам нужен Linkforge?",
      description:
        "Один линк вместо хаоса в био. Красивые страницы, аналитика, формы, AI и платежи — для создателей, freelancers и брендов.",
      isPublished: true,
      publishedAt: new Date(),
      theme: {
        create: {
          presetKey: "why-linkforge",
          tokens: {
            background: "#0a0a0f",
            surface: "#16161f",
            text: "#f4f4f5",
            accent: "#8b5cf6",
            radius: 18,
            font: "Inter",
          },
        },
      },
      blocks: {
        create: [
          {
            type: BlockType.AVATAR,
            order: 0,
            content: {
              src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop",
            },
          },
          {
            type: BlockType.HEADER,
            order: 1,
            content: {
              title: "Почему вам нужен Linkforge?",
              subtitle: "Один линк · вся ваша вселенная",
            },
          },
          {
            type: BlockType.TEXT,
            order: 2,
            content: {
              text: "Instagram, TikTok, Telegram, YouTube — в био только одна ссылка. Linkforge превращает её в мини-сайт: портфолио, магазин, форма заявок и аналитика в одном месте.",
              align: "center",
            },
          },
          {
            type: BlockType.BUTTON,
            order: 3,
            label: "Создать страницу бесплатно",
            url: "http://localhost:3000/register",
            content: {
              label: "Создать страницу бесплатно",
              url: "http://localhost:3000/register",
              variant: "primary",
            },
          },
          {
            type: BlockType.DIVIDER,
            order: 4,
            content: { spacing: 8 },
          },
          {
            type: BlockType.TEXT,
            order: 5,
            content: {
              text: "🔥 6 причин выбрать Linkforge",
              align: "center",
            },
          },
          {
            type: BlockType.LINK,
            order: 6,
            label: "1. Красивый page builder за минуты",
            url: "http://localhost:3000/register",
            content: {
              label: "1. Красивый page builder за минуты",
              url: "http://localhost:3000/register",
              icon: "✨",
            },
          },
          {
            type: BlockType.TEXT,
            order: 7,
            content: {
              text: "Drag-and-drop блоки: ссылки, кнопки, видео, галерея, FAQ, карта, форма. Темы и цвета — без дизайнера и кода.",
              align: "left",
            },
          },
          {
            type: BlockType.LINK,
            order: 8,
            label: "2. Аналитика, а не «угадайки»",
            url: "http://localhost:3000/dashboard/analytics",
            content: {
              label: "2. Аналитика, а не «угадайки»",
              url: "http://localhost:3000/dashboard/analytics",
              icon: "📊",
            },
          },
          {
            type: BlockType.TEXT,
            order: 9,
            content: {
              text: "Просмотры, клики, устройства, GEO. Понимаете, что работает — и что убрать. Как у серьёзного SaaS, не как у конструктора-игрушки.",
              align: "left",
            },
          },
          {
            type: BlockType.LINK,
            order: 10,
            label: "3. Лиды прямо в inbox",
            url: "http://localhost:3000/dashboard/leads",
            content: {
              label: "3. Лиды прямо в inbox",
              url: "http://localhost:3000/dashboard/leads",
              icon: "📥",
            },
          },
          {
            type: BlockType.TEXT,
            order: 11,
            content: {
              text: "Форма на странице → заявки в Dashboard → Leads. Клиенты, подписчики, брифы — без сторонних Google Forms.",
              align: "left",
            },
          },
          {
            type: BlockType.LINK,
            order: 12,
            label: "4. AI co-pilot для текста и темы",
            url: "http://localhost:3000/dashboard/ai",
            content: {
              label: "4. AI co-pilot для текста и темы",
              url: "http://localhost:3000/dashboard/ai",
              icon: "🤖",
            },
          },
          {
            type: BlockType.TEXT,
            order: 13,
            content: {
              text: "Био, CTA, палитра, SEO-подсказки. Не знаете, что написать — AI предложит за секунды.",
              align: "left",
            },
          },
          {
            type: BlockType.LINK,
            order: 14,
            label: "5. Донаты и digital products",
            url: "http://localhost:3000/#pricing",
            content: {
              label: "5. Донаты и digital products",
              url: "http://localhost:3000/#pricing",
              icon: "💳",
            },
          },
          {
            type: BlockType.TEXT,
            order: 15,
            content: {
              text: "Stripe checkout для донатов и товаров. 0% комиссии Linkforge — деньги идут вам. PRO — когда готовы масштабироваться.",
              align: "left",
            },
          },
          {
            type: BlockType.LINK,
            order: 16,
            label: "6. Self-host или облако — ваш выбор",
            url: "http://localhost:3000/",
            content: {
              label: "6. Self-host или облако — ваш выбор",
              url: "http://localhost:3000/",
              icon: "🛡️",
            },
          },
          {
            type: BlockType.TEXT,
            order: 17,
            content: {
              text: "Open-source, Docker, Postgres, Redis. Данные у вас. Безопасность: argon2, 2FA, rate-limit, RBAC.",
              align: "left",
            },
          },
          {
            type: BlockType.DIVIDER,
            order: 18,
            content: { spacing: 12 },
          },
          {
            type: BlockType.IMAGE,
            order: 19,
            content: {
              src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&fit=crop",
              alt: "Analytics dashboard",
              href: "http://localhost:3000/register",
            },
          },
          {
            type: BlockType.FAQ,
            order: 20,
            content: {
              items: [
                {
                  q: "Это бесплатно?",
                  a: "Да — Free plan навсегда: страница, блоки, базовая аналитика. PRO — когда нужны unlimited pages, AI, домены и продажи.",
                },
                {
                  q: "Чем лучше Linktree?",
                  a: "Больше блоков (формы, FAQ, карта, продукты), нормальная аналитика, AI, self-host и вы не заперты в чужом SaaS.",
                },
                {
                  q: "Нужен ли код?",
                  a: "Нет. Регистрация → New page → блоки → Publish. Разработчикам — API, webhooks и Docker.",
                },
                {
                  q: "Кому подходит?",
                  a: "Креаторам, коучам, freelancers, музыкантам, стартапам, локальному бизнесу — всем, у кого одна ссылка в био и много, что показать.",
                },
                {
                  q: "Как быстро запуститься?",
                  a: "Обычно меньше минуты: аккаунт, slug, 3–5 ссылок, Publish. Готово для Instagram / TikTok / Telegram.",
                },
              ],
            },
          },
          {
            type: BlockType.COUNTDOWN,
            order: 21,
            content: {
              targetAt: launch.toISOString(),
              finishedText: "Пора создать свою страницу 🚀",
            },
          },
          {
            type: BlockType.GALLERY,
            order: 22,
            content: {
              layout: "grid",
              images: [
                "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&fit=crop",
                "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=600&fit=crop",
                "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&fit=crop",
                "https://images.unsplash.com/photo-1551434678-e076c223a692?w=600&fit=crop",
              ],
            },
          },
          {
            type: BlockType.SOCIAL,
            order: 23,
            label: "Мы рядом",
            content: {
              items: [
                { kind: "github", href: "https://github.com/kebruni/Linkforge" },
                { kind: "email", href: "mailto:hello@linkforge.local" },
              ],
            },
          },
          {
            type: BlockType.FORM,
            order: 24,
            content: {
              title: "Хочу early access / демо",
              submitLabel: "Отправить",
              fields: [
                { name: "name", label: "Имя", type: "text", required: true },
                { name: "email", label: "Email", type: "email", required: true },
                {
                  name: "use_case",
                  label: "Для чего нужна страница?",
                  type: "textarea",
                  required: false,
                },
              ],
            },
          },
          {
            type: BlockType.PRODUCT,
            order: 25,
            label: "PRO месяц",
            content: {
              title: "Linkforge PRO · 1 месяц",
              priceMinor: 800,
              currency: "USD",
              description: "Unlimited pages, AI, custom domain, donations & products. Демо checkout.",
              imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&fit=crop",
            },
          },
          {
            type: BlockType.DONATION,
            order: 26,
            content: {
              title: "Поддержать open-source 💜",
              amounts: [3, 5, 10],
              currency: "USD",
            },
          },
          {
            type: BlockType.BUTTON,
            order: 27,
            label: "Начать бесплатно →",
            url: "http://localhost:3000/register",
            content: {
              label: "Начать бесплатно →",
              url: "http://localhost:3000/register",
              variant: "primary",
            },
          },
          {
            type: BlockType.TEXT,
            order: 28,
            content: {
              text: "Без карты · Free forever · Self-host за 5 минут",
              align: "center",
            },
          },
        ],
      },
    },
    select: { id: true, slug: true, title: true, userId: true },
  });

  console.log("OK", page);
  console.log("Public: http://localhost:3000/u/" + SLUG);
  console.log("LAN:    http://192.168.0.151:3000/u/" + SLUG);
  console.log("Edit:   http://localhost:3000/dashboard/pages/" + page.id + "/edit");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
