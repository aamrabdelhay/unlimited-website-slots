import { isAdminSession, isSameOriginMutation } from "@/lib/admin-auth";
import { readCustomLinks, saveCustomLinks, validateSlug, validateTarget } from "@/lib/custom-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  if (!isAdminSession(request)) return Response.json({ ok: false, error: "غير مصرح." }, { status: 401 });
  if (!isSameOriginMutation(request)) return Response.json({ ok: false, error: "طلب غير مسموح." }, { status: 403 });
  const { id } = await context.params;
  let body: { label?: unknown; slug?: unknown; target?: unknown; enabled?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, error: "بيانات الطلب غير صالحة." }, { status: 400 }); }

  try {
    const links = await readCustomLinks();
    const index = links.findIndex((link) => link.id === id);
    if (index < 0) return Response.json({ ok: false, error: "الرابط غير موجود." }, { status: 404 });
    const current = links[index];
    const label = body.label === undefined ? current.label : typeof body.label === "string" ? body.label.trim() : "";
    const slug = body.slug === undefined ? current.slug : validateSlug(body.slug);
    const target = body.target === undefined ? current.target : validateTarget(body.target);
    const enabled = body.enabled === undefined ? current.enabled : typeof body.enabled === "boolean" ? body.enabled : null;
    if (!label || label.length > 80 || !slug || !target || enabled === null) {
      return Response.json({ ok: false, error: "راجع البيانات التي تريد تعديلها." }, { status: 400 });
    }
    if (links.some((link) => link.id !== id && link.slug === slug)) {
      return Response.json({ ok: false, error: "هذا الرابط مستخدم بالفعل. اختر اسمًا آخر." }, { status: 409 });
    }
    const updated = { ...current, label, slug, target, enabled, updatedAt: new Date().toISOString() };
    const next = [...links];
    next[index] = updated;
    await saveCustomLinks(next);
    return Response.json({ ok: true, link: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Custom link update failed:", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ ok: false, error: "تعذر تحديث الرابط." }, { status: 503 });
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!isAdminSession(request)) return Response.json({ ok: false, error: "غير مصرح." }, { status: 401 });
  if (!isSameOriginMutation(request)) return Response.json({ ok: false, error: "طلب غير مسموح." }, { status: 403 });
  const { id } = await context.params;
  try {
    const links = await readCustomLinks();
    const next = links.filter((link) => link.id !== id);
    if (next.length === links.length) return Response.json({ ok: false, error: "الرابط غير موجود." }, { status: 404 });
    await saveCustomLinks(next);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Custom link delete failed:", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ ok: false, error: "تعذر حذف الرابط." }, { status: 503 });
  }
}