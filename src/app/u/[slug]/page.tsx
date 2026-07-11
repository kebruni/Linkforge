import { Suspense } from "react";
import { notFound } from "next/navigation";
import Script from "next/script";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { buildMetadata, jsonLdPerson } from "@/lib/seo";
import { PageRenderer } from "@/components/public/page-renderer";
import { PaidBanner } from "@/components/public/paid-banner";
import { ReportPageButton } from "@/features/public/report-page-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Params {
  params: Promise<{ slug: string }>;
}

const fetchPage = unstable_cache(
  async (slug: string) => {
    const page = await prisma.page.findFirst({
      where: { slug, isPublished: true, deletedAt: null },
      include: {
        blocks: { where: { deletedAt: null }, orderBy: { order: "asc" } },
        theme: true,
        user: { select: { username: true, name: true, avatarUrl: true } },
      },
    });
    return page;
  },
  ["public-page"],
  { tags: ["public-page"], revalidate: 60 },
);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPage(slug);
  if (!page) return { title: "Not found" };
  return buildMetadata({
    title: page.title,
    description: page.description ?? `${page.user.name ?? page.user.username} on Linkforge`,
    image: page.ogImageUrl ?? undefined,
    canonical: `${env.APP_URL}/u/${page.slug}`,
  });
}

export default async function PublicPage({ params }: Params) {
  const { slug } = await params;
  const page = await fetchPage(slug);
  if (!page) notFound();

  const ld = jsonLdPerson({
    name: page.user.name ?? page.user.username,
    url: `${env.APP_URL}/u/${page.slug}`,
    image: page.user.avatarUrl ?? undefined,
  });

  return (
    <>
      <Suspense fallback={null}>
        <PaidBanner />
      </Suspense>
      <PageRenderer page={page} />
      <div className="flex justify-center py-6">
        <ReportPageButton pageId={page.id} />
      </div>
      <Script
        id="public-page-tracker"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  try {
    var pid=${JSON.stringify(page.id)};
    var params=new URLSearchParams(location.search);
    var utm={
      source:params.get('utm_source')||undefined,
      medium:params.get('utm_medium')||undefined,
      campaign:params.get('utm_campaign')||undefined,
      term:params.get('utm_term')||undefined,
      content:params.get('utm_content')||undefined
    };
    var hasUtm=utm.source||utm.medium||utm.campaign||utm.term||utm.content;
    var send=function(body){
      if(hasUtm) body.utm=utm;
      try {
        var blob=new Blob([JSON.stringify(body)],{type:'application/json'});
        navigator.sendBeacon('/api/analytics/track',blob);
      } catch(e){
        fetch('/api/analytics/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),keepalive:true}).catch(function(){});
      }
    };
    send({type:'PAGE_VIEW',pageId:pid,referer:document.referrer||null});
    document.addEventListener('click',function(e){
      var a=e.target instanceof Element ? e.target.closest('[data-track-block-id]') : null;
      if(!a) return;
      var bid=a.getAttribute('data-track-block-id');
      send({type:'BLOCK_CLICK',pageId:pid,blockId:bid});
    },{passive:true});
  } catch(_) {}
})();
          `.trim(),
        }}
      />
      <Script id="ld-json" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </>
  );
}
