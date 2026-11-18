import { randomUUID } from "node:crypto";
import { isAdminSession, isSameOriginMutation } from "@/lib/admin-auth";
import { readCustomLinks, saveCustomLinks, validateSlug, validateTarget, type CustomLink } from "@/lib/custom-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminSession(request)) return Response.json({ ok: false, error: "غير مصرح." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const links = await readCustomLinks();
    return Response.json({ ok: true, links }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Custom links read failed:", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ ok: false, error: "تعذر تحميل الروابط من التخزين." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isAdminSession(request)) return Response.json({ ok: false, error: "غير مصرح." }, { status: 401 });
  if (!isSameOriginMutation(request)) return Response.json({ ok: false, error: "طلب غير مسموح." }, { status: 403 });
  let body: { label?: unknown; slug?: unknown; target?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, error: "بيانات الطلب غير صالحة." }, { status: 400 }); }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  const slug = validateSlug(body.slug);
  const target = validateTarget(body.target);
  if (!label || label.length > 80 || !slug || !target) {
    return Response.json({ ok: false, error: "راجع الاسم والرابط المختصر ومسار الصفحة. استخدم حروفًا وأرقامًا إنجليزية وشرطة فقط في الرابط." }, { status: 400 });
  }

  try {
    const links = await readCustomLinks();
    if (links.some((link) => link.slug === slug)) {
      return Response.json({ ok: false, error: "هذا الرابط مستخدم بالفعل. اختر اسمًا آخر." }, { status: 409 });
    }
    const now = new Date().toISOString();
    const link: CustomLink = { id: randomUUID(), label, slug, target, enabled: true, createdAt: now, updatedAt: now };
    await saveCustomLinks([...links, link]);
    return Response.json({ ok: true, link }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Custom link create failed:", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ ok: false, error: "تعذر حفظ الرابط. حاول مرة أخرى." }, { status: 503 });
  }
}