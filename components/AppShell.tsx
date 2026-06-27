"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/ToastProvider";

const navigation = [
  { href: "/", label: "Dashboard", icon: "D" },
  { href: "/media", label: "Media", icon: "M" },
  { href: "/settings", label: "Settings", icon: "S" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const response = await fetch("/api/resolume/status", { cache: "no-store" });
        const data = (await response.json()) as { status?: { connected?: boolean } };
        if (active) {
          setConnected(Boolean(data.status?.connected));
        }
      } catch {
        if (active) {
          setConnected(false);
        }
      }
    }

    check();
    const interval = window.setInterval(check, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/10 bg-slate-950/80 p-5 backdrop-blur xl:block">
          <Link href="/" className="block rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm uppercase tracking-[0.35em] text-sky-300">Qubit</div>
            <div className="mt-2 text-2xl font-black">Resolume Companion</div>
          </Link>
          <nav className="mt-8 space-y-3">
            {navigation.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-16 items-center gap-4 rounded-2xl px-5 text-lg font-bold transition ${
                    active ? "bg-sky-400 text-slate-950" : "bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-slate-400">Resolume</div>
            <div className="mt-2 flex items-center gap-3 text-lg font-bold">
              <span className={`h-3 w-3 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-400"}`} />
              {connected ? "Connected" : "Disconnected"}
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col xl:pl-72">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur md:px-8 xl:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="text-lg font-black">
                Resolume Companion
              </Link>
              <div className="flex gap-2">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3 py-3 text-sm font-bold ${
                      pathname === item.href ? "bg-sky-400 text-slate-950" : "bg-white/10"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
