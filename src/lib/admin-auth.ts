import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "unlimited_admin_session";
const SESSION_LABEL = "unlimited-admin-session-v1";

function configuredPassword(): string | null {
  const value = process.env.UNLIMITED_ADMIN_PASSWORD;
  return value && value.length >= 16 ? value : null;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyAdminPassword(candidate: unknown): boolean {
  const password = configuredPassword();
  return typeof candidate === "string" && !!password && safeEqual(candidate, password);
}

function sessionSignature(): string | null {
  const password = configuredPassword();
  if (!password) return null;
  return createHmac("sha256", password).update(SESSION_LABEL).digest("hex");
}

export function isAdminSession(request: Request): boolean {
  const signature = sessionSignature();
  if (!signature) return false;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(ADMIN_COOKIE_NAME + "="))
    ?.slice(ADMIN_COOKIE_NAME.length + 1);
  return typeof token === "string" && safeEqual(token, signature);
}

export function createAdminCookie(request: Request): string | null {
  const signature = sessionSignature();
  if (!signature) return null;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return ADMIN_COOKIE_NAME + "=" + signature + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200" + secure;
}

export function clearAdminCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return ADMIN_COOKIE_NAME + "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" + secure;
}

export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}