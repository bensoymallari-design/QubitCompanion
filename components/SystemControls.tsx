"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";

interface SystemControlsProps {
  enabled: boolean;
}

type ControlAction =
  | {
      label: string;
      description: string;
      endpoint: "/api/resolume/app";
      action: "save" | "save-close" | "close-without-save";
      confirmation: string;
      tone: "safe" | "warning" | "danger";
    }
  | {
      label: string;
      description: string;
      endpoint: "/api/system/power";
      action: "shutdown" | "restart";
      confirmation: string;
      tone: "safe" | "warning" | "danger";
    };

const ACTIONS: ControlAction[] = [
  {
    label: "Save Resolume",
    description: "Send Ctrl+S to the Resolume window.",
    endpoint: "/api/resolume/app",
    action: "save",
    confirmation: "SAVE",
    tone: "safe"
  },
  {
    label: "Save & Close Resolume",
    description: "Send Ctrl+S, close Resolume, then confirm the Save & Quit dialog.",
    endpoint: "/api/resolume/app",
    action: "save-close",
    confirmation: "SAVE CLOSE",
    tone: "warning"
  },
  {
    label: "Close Resolume Without Save",
    description: "Force-close Resolume. Unsaved changes may be lost.",
    endpoint: "/api/resolume/app",
    action: "close-without-save",
    confirmation: "CLOSE WITHOUT SAVE",
    tone: "danger"
  },
  {
    label: "Shutdown PC",
    description: "Schedule Windows shutdown in 10 seconds.",
    endpoint: "/api/system/power",
    action: "shutdown",
    confirmation: "SHUTDOWN",
    tone: "danger"
  },
  {
    label: "Restart PC",
    description: "Schedule Windows restart in 10 seconds.",
    endpoint: "/api/system/power",
    action: "restart",
    confirmation: "RESTART",
    tone: "danger"
  }
];

export function SystemControls({ enabled }: SystemControlsProps) {
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<string | null>(null);
  const { notify } = useToast();

  async function runAction(item: ControlAction) {
    setRunning(item.action);
    try {
      const response = await fetch(item.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: item.action, confirmation: confirmations[item.action] ?? "" })
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Action failed");
      }

      notify(data.message ?? "Action sent", "success");
      setConfirmations((current) => ({ ...current, [item.action]: "" }));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed", "error");
    } finally {
      setRunning(null);
    }
  }

  return (
    <section className="rounded-[2rem] border border-rose-400/30 bg-rose-500/10 p-6">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-rose-200">Danger Zone</p>
      <h2 className="mt-2 text-2xl font-black">Resolume and PC power controls</h2>
      <p className="mt-2 text-sm text-rose-50/80">
        These commands run on the Windows PC hosting this app. Enable system controls above, then type the exact confirmation phrase for each action.
      </p>

      {!enabled && (
        <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">
          System controls are currently disabled. Turn on "Enable System Controls" and save settings first.
        </div>
      )}

      <div className="mt-5 grid gap-4">
        {ACTIONS.map((item) => {
          const disabled = !enabled || running !== null || confirmations[item.action] !== item.confirmation;

          return (
            <div key={item.action} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-black">{item.label}</h3>
                  <p className="mt-1 text-sm text-slate-300">{item.description}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Type: {item.confirmation}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] lg:w-[30rem]">
                  <input
                    value={confirmations[item.action] ?? ""}
                    onChange={(event) => setConfirmations((current) => ({ ...current, [item.action]: event.target.value }))}
                    placeholder={item.confirmation}
                    className="min-h-12 rounded-2xl bg-black/40 px-4 font-mono"
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => runAction(item)}
                    className={`min-h-12 rounded-2xl px-5 font-black disabled:cursor-not-allowed disabled:opacity-40 ${
                      item.tone === "safe"
                        ? "bg-emerald-300 text-slate-950"
                        : item.tone === "warning"
                          ? "bg-amber-300 text-slate-950"
                          : "bg-rose-400 text-white"
                    }`}
                  >
                    {running === item.action ? "Sending..." : item.label}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
