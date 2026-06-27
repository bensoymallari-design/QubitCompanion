"use client";

import { useEffect, useState } from "react";
import type { ResolumeStatus } from "@/types/resolume";

export function DashboardRefresh({ initialStatus }: { initialStatus: ResolumeStatus }) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/resolume/status", { cache: "no-store" });
        const data = (await response.json()) as { status: ResolumeStatus };
        setStatus(data.status);
      } catch {
        setStatus((current) => ({ ...current, connected: false, message: "Status check failed" }));
      }
    }, 8000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-400">Resolume Status</p>
      <div className="mt-4 flex items-center gap-4">
        <span className={`h-5 w-5 rounded-full ${status.connected ? "bg-emerald-400" : "bg-rose-400"}`} />
        <div>
          <div className="text-3xl font-black">{status.connected ? "Connected" : "Disconnected"}</div>
          <div className="mt-1 text-sm text-slate-400">{status.message}</div>
        </div>
      </div>
      <div className="mt-5 rounded-2xl bg-black/20 p-4 font-mono text-sm text-slate-300">{status.url}</div>
    </div>
  );
}
