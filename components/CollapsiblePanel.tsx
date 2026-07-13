"use client";

import { useState, type ReactNode } from "react";

interface CollapsiblePanelProps {
  title: string;
  eyebrow?: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsiblePanel({ title, eyebrow, description, defaultOpen = true, children }: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-xl shadow-black/10">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-20 w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-300 md:p-6"
        aria-expanded={open}
      >
        <span className="min-w-0">
          {eyebrow && <span className="block text-xs font-black uppercase tracking-[0.35em] text-sky-300">{eyebrow}</span>}
          <span className="mt-1 block text-2xl font-black text-white md:text-3xl">{title}</span>
          {description && <span className="mt-2 block text-sm font-medium text-slate-300">{description}</span>}
        </span>
        <span className="shrink-0 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-slate-200">
          {open ? "Collapse -" : "Expand +"}
        </span>
      </button>
      {open && <div className="border-t border-white/10 p-5 md:p-6">{children}</div>}
    </section>
  );
}
