"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Copy, ExternalLink, Link2, LoaderCircle, LogOut, Pencil, Plus, Power, Trash2 } from "lucide-react";

type CustomLink = {
  id: string;
  label: string;
  slug: string;
  target: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const EMPTY_FORM = { label: "", slug: "", target: "/snake-evolution.html" };

function makePublicUrl(slug: string): string {
  if (typeof window === "undefined") return "/www." + slug + ".Amr";
  return window.location.origin + "/www." + slug + ".Amr";
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return typeof body.error === "string" ? body.error : "حدث خطأ غير متوقع.";
  } catch {
    return "تعذر الاتصال بالخادم.";
  }
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [links, setLinks] = useState<CustomLink[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const activeCount = useMemo(() => links.filter((link) => link.enabled).length, [links]);

  const loadLinks = useCallback(async () => {
    const response = await fetch("/api/admin/links", { cache: "no-store" });
    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }
    if (!response.ok) throw new Error(await responseError(response));
    const data = await response.json();
    setLinks(Array.isArray(data.links) ? data.links : []);
    setAuthenticated(true);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/links", { cache: "no-store" })
      .then(async (response) => {
        if (!alive) return;
        if (response.status === 401) {
          setAuthenticated(false);
          return;
        }
        if (!response.ok) throw new Error(await responseError(response));
        const data = await response.json();
        if (alive) {
          setLinks(Array.isArray(data.links) ? data.links : []);
          setAuthenticated(true);
        }
      })
      .catch((reason: unknown) => {
        if (alive) setError(reason instanceof Error ? reason.message : "تعذر الاتصال بالخادم.");
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => { alive = false; };
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setPassword("");
      await loadLinks();
      setMessage("تم تسجيل الدخول.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تسجيل الدخول.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const wasEditing = Boolean(editingId);
      const response = await fetch(editingId ? "/api/admin/links/" + editingId : "/api/admin/links", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await responseError(response));
      await loadLinks();
      setForm(EMPTY_FORM);
      setEditingId(null);
      setMessage(wasEditing ? "تم تحديث الرابط بنجاح." : "تم إنشاء الرابط بنجاح.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر حفظ الرابط.");
    } finally {
      setBusy(false);
    }
  }

  function startEditing(link: CustomLink) {
    setForm({ label: link.label, slug: link.slug, target: link.target });
    setEditingId(link.id);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleLink(link: CustomLink) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/links/" + link.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !link.enabled }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      await loadLinks();
      setMessage(link.enabled ? "تم إيقاف الرابط." : "تم تفعيل الرابط.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تغيير حالة الرابط.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLink(link: CustomLink) {
    if (!window.confirm("هل تريد حذف رابط " + link.label + "؟")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/links/" + link.id, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response));
      await loadLinks();
      if (editingId === link.id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      setMessage("تم حذف الرابط.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر حذف الرابط.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(link: CustomLink) {
    try {
      await navigator.clipboard.writeText(makePublicUrl(link.slug));
      setCopiedId(link.id);
      window.setTimeout(() => setCopiedId((current) => current === link.id ? null : current), 1800);
    } catch {
      setError("تعذر النسخ تلقائيًا. انسخ الرابط يدويًا.");
    }
  }

  async function logout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setAuthenticated(false);
    setLinks([]);
    setMessage("");
    setError("");
  }

  if (checking) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#090d14] text-stone-200">
        <div className="flex items-center gap-3 text-sm text-stone-400"><LoaderCircle className="h-5 w-5 animate-spin" /> جارٍ التحقق من جلسة الإدارة...</div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,#1b2a3d_0%,#090d14_58%)] px-5 py-12 text-stone-100">
        <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#111a27]/90 p-7 shadow-2xl backdrop-blur-xl sm:p-9">
          <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-300/20 bg-sky-300/10 text-sky-200"><Link2 className="h-7 w-7" /></div>
          <p className="mb-2 text-xs font-semibold tracking-[0.24em] text-sky-200/70">UNLIMITED · CONTROL</p>
          <h1 className="text-2xl font-bold">إدارة الروابط المخصصة</h1>
          <p className="mt-3 text-sm leading-7 text-stone-400">سجّل الدخول لإنشاء روابط مختصرة ومشاركتها مع أي شخص.</p>
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <label className="block text-sm font-medium text-stone-300" htmlFor="admin-password">كلمة مرور الإدارة</label>
            <input id="admin-password" autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required className="w-full rounded-xl border border-white/10 bg-[#090f18] px-4 py-3.5 text-left tracking-widest text-white outline-none transition focus:border-sky-300/50" placeholder="••••••••••••" />
            {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
            <button disabled={busy || !password} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-200 px-5 py-3.5 font-bold text-slate-950 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} دخول لوحة الإدارة
            </button>
          </form>
          <a href="/" className="mt-6 inline-flex items-center gap-2 text-sm text-stone-500 transition hover:text-stone-200"><ArrowUpRight className="h-4 w-4" /> الصفحة الرئيسية</a>
        </section>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#090d14] px-4 py-7 text-stone-100 sm:px-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="mb-2 text-[11px] font-bold tracking-[0.25em] text-sky-200/70">UNLIMITED · LINK MANAGER</p>
            <h1 className="text-2xl font-bold sm:text-3xl">لوحة إدارة الروابط</h1>
            <p className="mt-2 text-sm text-stone-400">أنشئ عنوانًا مميزًا لأي صفحة داخل موقع Unlimited.</p>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-stone-300 transition hover:border-rose-300/30 hover:text-rose-200"><LogOut className="h-4 w-4" /> تسجيل الخروج</button>
        </header>

        <div className="mb-7 grid grid-cols-2 gap-3 sm:max-w-lg">
          <div className="rounded-2xl border border-white/10 bg-[#111a27] p-4"><p className="text-xs text-stone-500">إجمالي الروابط</p><p className="mt-2 text-3xl font-semibold tabular-nums">{links.length}</p></div>
          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4"><p className="text-xs text-emerald-200/60">روابط نشطة</p><p className="mt-2 text-3xl font-semibold tabular-nums text-emerald-100">{activeCount}</p></div>
        </div>

        <section className="mb-8 rounded-3xl border border-white/10 bg-[#111a27] p-5 sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-300/10 text-sky-200">{editingId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}</div>
            <div><h2 className="font-bold">{editingId ? "تعديل الرابط" : "إنشاء رابط جديد"}</h2><p className="mt-1 text-xs text-stone-500">اكتب الاسم والمسار الذي سيفتحه الرابط.</p></div>
          </div>
          <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-3">
            <label className="text-sm text-stone-300">اسم الصفحة
              <input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} required maxLength={80} placeholder="مثال: لعبة الثعبان" className="mt-2 w-full rounded-xl border border-white/10 bg-[#090f18] px-4 py-3 text-stone-100 outline-none focus:border-sky-300/50" />
            </label>
            <label className="text-sm text-stone-300">اسم الرابط بالإنجليزية
              <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} required minLength={2} maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="snake" dir="ltr" className="mt-2 w-full rounded-xl border border-white/10 bg-[#090f18] px-4 py-3 text-left text-stone-100 outline-none focus:border-sky-300/50" />
            </label>
            <label className="text-sm text-stone-300">مسار الصفحة الأصلية
              <input value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} required maxLength={200} placeholder="/snake-evolution.html" dir="ltr" className="mt-2 w-full rounded-xl border border-white/10 bg-[#090f18] px-4 py-3 text-left text-stone-100 outline-none focus:border-sky-300/50" />
            </label>
            <div className="rounded-xl border border-sky-300/15 bg-sky-300/[0.04] px-4 py-3 md:col-span-3">
              <p className="text-[11px] text-sky-100/60">معاينة الرابط الذي سيظهر للناس</p>
              <p dir="ltr" className="mt-1 break-all text-sm font-semibold text-sky-100">{form.slug.trim() ? makePublicUrl(form.slug.trim().toLowerCase()) : "https://mws-psi.vercel.app/www.your-name.Amr"}</p>
            </div>
            {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200 md:col-span-3">{error}</p>}
            {message && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200 md:col-span-3">{message}</p>}
            <div className="flex flex-wrap gap-2 md:col-span-3">
              <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-200 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-sky-100 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editingId ? "حفظ التعديلات" : "إنشاء الرابط"}</button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setError(""); }} className="rounded-xl border border-white/10 px-5 py-3 text-sm text-stone-300 hover:bg-white/5">إلغاء التعديل</button>}
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#111a27]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-7">
            <div><h2 className="font-bold">الروابط التي أنشأتها</h2><p className="mt-1 text-xs text-stone-500">كل رابط يعمل مباشرة ويفتح الصفحة المحددة.</p></div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-stone-400">{links.length} رابط</span>
          </div>
          {links.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-stone-500">لا توجد روابط بعد. أنشئ أول رابط من النموذج أعلاه.</div>
          ) : (
            <div className="divide-y divide-white/[0.07]">
              {links.map((link) => (
                <article key={link.id} className="flex flex-col gap-4 px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-stone-100">{link.label}</h3><span className={"rounded-full px-2.5 py-1 text-[10px] font-semibold " + (link.enabled ? "bg-emerald-300/10 text-emerald-200" : "bg-stone-500/15 text-stone-400")}>{link.enabled ? "نشط" : "متوقف"}</span></div>
                    <a href={makePublicUrl(link.slug)} target="_blank" rel="noreferrer" dir="ltr" className="mt-2 inline-flex max-w-full items-center gap-2 break-all text-sm text-sky-200 hover:text-sky-100">{makePublicUrl(link.slug)} <ExternalLink className="h-3.5 w-3.5 shrink-0" /></a>
                    <p dir="ltr" className="mt-1 break-all text-xs text-stone-500">يفتح: {link.target}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => copyLink(link)} className="inline-flex items-center gap-2 rounded-lg border border-sky-200/20 px-3 py-2 text-xs text-sky-100 hover:bg-sky-200/10">{copiedId === link.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedId === link.id ? "تم النسخ" : "نسخ الرابط"}</button>
                    <button onClick={() => startEditing(link)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-stone-300 hover:bg-white/5"><Pencil className="h-3.5 w-3.5" /> تعديل</button>
                    <button disabled={busy} onClick={() => toggleLink(link)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-stone-300 hover:bg-white/5"><Power className="h-3.5 w-3.5" />{link.enabled ? "إيقاف" : "تفعيل"}</button>
                    <button disabled={busy} onClick={() => deleteLink(link)} className="inline-flex items-center gap-2 rounded-lg border border-rose-300/15 px-3 py-2 text-xs text-rose-200 hover:bg-rose-300/10"><Trash2 className="h-3.5 w-3.5" /> حذف</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <footer className="py-7 text-center text-[11px] text-stone-600">Unlimited · Custom links</footer>
        {message && <p className="mt-3 text-center text-xs text-emerald-200" role="status">{message}</p>}
      </div>
    </main>
  );
}