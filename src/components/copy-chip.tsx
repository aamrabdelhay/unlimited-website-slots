"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Click-to-copy command chip for CLI workflows. */
export function CopyChip({ command, label }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      // Clipboard API unavailable (non-secure context) — selection fallback.
      const textarea = document.createElement("textarea");
      textarea.value = command;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : "Copy command"}
      className="group inline-flex max-w-full items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-left font-mono text-xs text-stone-300 transition-colors hover:border-amber-300/40 hover:text-amber-200"
    >
      <span className="select-none text-amber-300/80">$</span>
      <span className="truncate">{label ?? command}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-label="Copied" />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-100" aria-hidden />
      )}
    </button>
  );
}
