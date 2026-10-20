"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Public, password-free contact form. Posts JSON to the slot's own API
 * endpoint (rate-limited + validated server-side, with a honeypot field
 * for spam control).
 */

type FormState =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "success" }
  | { phase: "error"; message: string };

export function ContactForm({ endpoint }: { endpoint: string }) {
  const [state, setState] = useState<FormState>({ phase: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState({ phase: "sending" });
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          message: String(data.get("message") ?? ""),
          company: String(data.get("company") ?? ""), // honeypot
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (response.ok && payload?.ok) {
        form.reset();
        setState({ phase: "success" });
      } else {
        setState({
          phase: "error",
          message:
            payload?.error?.message ??
            `The message could not be sent (HTTP ${response.status}).`,
        });
      }
    } catch {
      setState({
        phase: "error",
        message: "Network error — the studio server could not be reached.",
      });
    }
  }

  const sending = state.phase === "sending";

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate={false}>
      <div>
        <label
          htmlFor="meridian-name"
          className="block text-xs font-medium uppercase tracking-[0.18em] text-[#1b1813]/60"
        >
          Name
        </label>
        <input
          id="meridian-name"
          name="name"
          type="text"
          required
          maxLength={80}
          autoComplete="name"
          className="mt-2 w-full border border-[#1b1813]/25 bg-transparent px-4 py-3 text-base outline-none transition-colors focus:border-[#1b1813]"
          placeholder="Jane Appleseed"
        />
      </div>
      <div>
        <label
          htmlFor="meridian-email"
          className="block text-xs font-medium uppercase tracking-[0.18em] text-[#1b1813]/60"
        >
          Email <span className="normal-case text-[#1b1813]/40">(optional)</span>
        </label>
        <input
          id="meridian-email"
          name="email"
          type="email"
          maxLength={120}
          autoComplete="email"
          className="mt-2 w-full border border-[#1b1813]/25 bg-transparent px-4 py-3 text-base outline-none transition-colors focus:border-[#1b1813]"
          placeholder="jane@example.com"
        />
      </div>
      <div>
        <label
          htmlFor="meridian-message"
          className="block text-xs font-medium uppercase tracking-[0.18em] text-[#1b1813]/60"
        >
          Project
        </label>
        <textarea
          id="meridian-message"
          name="message"
          required
          maxLength={1000}
          rows={5}
          className="mt-2 w-full resize-y border border-[#1b1813]/25 bg-transparent px-4 py-3 text-base outline-none transition-colors focus:border-[#1b1813]"
          placeholder="A courtyard house in the desert…"
        />
      </div>

      {/* Honeypot — invisible to humans, attractive to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="meridian-company">Company</label>
        <input
          id="meridian-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <button
        type="submit"
        disabled={sending}
        className="group inline-flex items-center gap-3 bg-[#1b1813] px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#f4f1ea] transition-colors hover:bg-[#b34724] disabled:cursor-wait disabled:opacity-60"
      >
        {sending ? "Sending…" : "Send message"}
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-1"
          aria-hidden
        />
      </button>

      {state.phase === "success" && (
        <p role="status" className="flex items-center gap-2 border border-[#2f5d3f]/40 bg-[#2f5d3f]/10 px-4 py-3 text-sm text-[#2f5d3f]">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Thank you — your message is in the studio inbox. We reply within two working days.
        </p>
      )}
      {state.phase === "error" && (
        <p role="alert" className="flex items-start gap-2 border border-[#b34724]/40 bg-[#b34724]/10 px-4 py-3 text-sm text-[#8f3418]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
    </form>
  );
}
