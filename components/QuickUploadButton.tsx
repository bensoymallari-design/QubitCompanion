"use client";

import Link from "next/link";

export function QuickUploadButton() {
  return (
    <Link
      href="/media"
      className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-sky-300 px-8 text-xl font-black text-slate-950 shadow-lg shadow-sky-950/20 transition hover:bg-sky-200"
    >
      Quick Upload
    </Link>
  );
}
