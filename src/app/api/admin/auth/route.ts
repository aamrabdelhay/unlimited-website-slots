import { clearAdminCookie, createAdminCookie, isSameOriginMutation, verifyAdminPassword } from "@/lib/admin-auth";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8, maxBuckets: 3000 });

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ ok: false, error: "طلب غير مسموح." }, { status: 403 });
  const limit = loginLimiter.check(clientKey(request));
  if (!limit.ok) {
    return Response.json({ ok: false, error: "محاولات كثيرة. حاول مرة أخرى بعد قليل." }, {
      status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }
  if (!process.env.UNLIMITED_ADMIN_PASSWORD) {
    return Response.json({ ok: false, error: "إعداد كلمة مرور الإدارة غير مكتمل." }, { status: 503 });
  }
  let body: { password?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, error: "بيانات الطلب غير صالحة." }, { status: 400 }); }
  if (!verifyAdminPassword(body.password)) {
    return Response.json({ ok: false, error: "كلمة المرور غير صحيحة." }, { status: 401 });
  }
  const cookie = createAdminCookie(request);
  if (!cookie) return Response.json({ ok: false, error: "تعذر إنشاء جلسة الإدارة." }, { status: 503 });
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ ok: false, error: "طلب غير مسموح." }, { status: 403 });
  return Response.json({ ok: true }, {
    headers: { "Set-Cookie": clearAdminCookie(request), "Cache-Control": "no-store" },
  });
}