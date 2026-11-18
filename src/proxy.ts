import { NextRequest, NextResponse } from "next/server";
import { getCustomLinkBySlug } from "@/lib/custom-links";

export async function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/www\.([a-z0-9-]+)\.amr\/?$/i);
  if (!match) return NextResponse.next();
  try {
    const link = await getCustomLinkBySlug(match[1]);
    if (!link) return NextResponse.next();
    return NextResponse.rewrite(new URL(link.target, request.url));
  } catch (error) {
    console.error("Custom link resolution failed:", error instanceof Error ? error.name : "UnknownError");
    return new NextResponse("تعذر فتح الرابط حاليًا. حاول مرة أخرى.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}

export const config = {
  matcher: ["/www.:path*"],
};