import { apiError, apiJson, type SlotApiHandler } from "@/lib/site-contract";
import { clientKey, createRateLimiter } from "@/lib/rate-limit";
import { createMessage, listMessages, messageInputSchema } from "../lib/messages";

/**
 * /api/s/1/messages — password-free public endpoint.
 * Abuse protection: fixed-window rate limiting + honeypot + zod validation.
 */

const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export const getMessages: SlotApiHandler = async () => {
  const result = await listMessages(20);
  if (!result.ok) {
    return apiError(
      result.code === "unconfigured" ? 503 : 502,
      result.code === "unconfigured" ? "database_unconfigured" : "database_unavailable",
      result.message,
    );
  }
  return apiJson({
    ok: true,
    messages: result.data.map((row) => ({
      id: row.id,
      name: row.name,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
    })),
  });
};

export const postMessage: SlotApiHandler = async (request) => {
  const rate = limiter.check(clientKey(request));
  if (!rate.ok) {
    return apiError(429, "rate_limited", "Too many messages — please wait a moment.", {
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be JSON.");
  }

  const parsed = messageInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "invalid_input", "Please check the form fields.", {
      fields: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // Honeypot filled — bot. The implemented behavior is a deliberate,
  // documented spam drop (not an unimplemented fake success).
  if (parsed.data.company) {
    return apiJson({ ok: true, spam: true }, { status: 202 });
  }

  const created = await createMessage(parsed.data);
  if (!created.ok) {
    return apiError(503, "database_unavailable", created.message);
  }
  return apiJson({ ok: true, id: created.data.id }, { status: 201 });
};
