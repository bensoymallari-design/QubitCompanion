"use client";

import { useEffect, useState } from "react";
import { SystemControls } from "@/components/SystemControls";
import { useToast } from "@/components/ToastProvider";
import { DEFAULT_SETTINGS, type AppSettings } from "@/types/settings";

export function SettingsForm() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        const data = (await response.json()) as { settings?: AppSettings };
        setSettings(data.settings ?? DEFAULT_SETTINGS);
        document.body.classList.toggle("light-mode", data.settings?.darkMode === false);
      } catch {
        notify("Could not load settings", "error");
      }
    }

    load();
  }, [notify]);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    if (key === "darkMode") {
      document.body.classList.toggle("light-mode", value === false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings)
      });
      const data = (await response.json()) as { error?: string; settings?: AppSettings };
      if (!response.ok) {
        throw new Error(data.error ?? "Save failed");
      }
      setSettings(data.settings ?? settings);
      notify("Settings saved locally", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    await save();
    try {
      const response = await fetch("/api/resolume/connect", { method: "POST" });
      const data = (await response.json()) as { status?: { connected?: boolean; message?: string }; error?: string };
      if (!response.ok || !data.status?.connected) {
        throw new Error(data.status?.message ?? data.error ?? "Resolume disconnected");
      }
      notify("Resolume connection OK", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Connection failed", "error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Resolume IP</span>
            <input value={settings.resolumeIp} onChange={(event) => update("resolumeIp", event.target.value)} className="mt-2 min-h-16 w-full rounded-2xl bg-slate-950 px-5 text-xl" />
          </label>
          <label className="block">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Port</span>
            <input
              type="number"
              value={settings.resolumePort}
              onChange={(event) => update("resolumePort", Number(event.target.value))}
              className="mt-2 min-h-16 w-full rounded-2xl bg-slate-950 px-5 text-xl"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Server Upload Folder</span>
            <input value={settings.uploadFolder} onChange={(event) => update("uploadFolder", event.target.value)} className="mt-2 min-h-16 w-full rounded-2xl bg-slate-950 px-5 text-xl" />
            <span className="mt-2 block text-sm text-slate-400">
              This is a folder on the Windows PC running this app. Phones/tablets upload into this folder over LAN. Examples:
              `D:\Resolume Media`, `C:\Users\Public\Videos\Resolume`, or `storage/uploads`.
            </span>
          </label>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="flex min-h-16 items-center justify-between rounded-2xl bg-white/5 px-5 text-lg font-bold">
            Auto Refresh
            <input type="checkbox" checked={settings.autoRefresh} onChange={(event) => update("autoRefresh", event.target.checked)} className="h-7 w-7" />
          </label>
          <label className="flex min-h-16 items-center justify-between rounded-2xl bg-white/5 px-5 text-lg font-bold">
            Dark Mode
            <input type="checkbox" checked={settings.darkMode} onChange={(event) => update("darkMode", event.target.checked)} className="h-7 w-7" />
          </label>
          <label className="flex min-h-16 items-center justify-between rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 text-lg font-bold">
            Enable System Controls
            <input
              type="checkbox"
              checked={settings.allowSystemControls}
              onChange={(event) => update("allowSystemControls", event.target.checked)}
              className="h-7 w-7"
            />
          </label>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button type="button" disabled={saving} onClick={save} className="min-h-16 rounded-2xl bg-sky-300 px-8 text-xl font-black text-slate-950 disabled:opacity-50">
            {saving ? "Saving..." : "Save Settings"}
          </button>
          <button type="button" disabled={testing} onClick={testConnection} className="min-h-16 rounded-2xl bg-white/10 px-8 text-xl font-black disabled:opacity-50">
            {testing ? "Checking..." : "Test Connection"}
          </button>
        </div>
      </section>

      <aside className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-300">Defaults</p>
        <dl className="mt-5 space-y-4 text-slate-300">
          <div>
            <dt className="font-black text-white">IP</dt>
            <dd>127.0.0.1</dd>
          </div>
          <div>
            <dt className="font-black text-white">Port</dt>
            <dd>8080</dd>
          </div>
          <div>
            <dt className="font-black text-white">Storage</dt>
            <dd>Uploads save to your configured server folder. Metadata stays in storage/database.json.</dd>
          </div>
        </dl>
      </aside>
      <div className="xl:col-span-2">
        <SystemControls enabled={settings.allowSystemControls} />
      </div>
    </div>
  );
}
