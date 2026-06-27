"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import type { ResolumeControlScope, ResolumeEffect, ResolumeParameter, ResolumeParameterValue } from "@/types/resolume";

interface ResolumeAdvancedControlsProps {
  layer: number;
  clip: number;
}

const GROUP_LABELS: Record<ResolumeParameter["group"], string> = {
  transform: "Transform / Expand",
  effect: "Effects",
  audio: "Audio",
  transport: "Transport",
  other: "Other Parameters"
};

export function ResolumeAdvancedControls({ layer, clip }: ResolumeAdvancedControlsProps) {
  const [scope, setScope] = useState<ResolumeControlScope>("clip");
  const [parameters, setParameters] = useState<ResolumeParameter[]>([]);
  const [effects, setEffects] = useState<ResolumeEffect[]>([]);
  const [effectInput, setEffectInput] = useState("");
  const [removeIndex, setRemoveIndex] = useState("1");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [effectManagerOpen, setEffectManagerOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<ResolumeParameter["group"], boolean>>({
    transform: true,
    effect: false,
    audio: false,
    transport: false,
    other: false
  });
  const { notify } = useToast();

  const loadParameters = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        scope,
        layer: String(layer),
        clip: String(clip)
      });
      const response = await fetch(`/api/resolume/parameters?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as { parameters?: ResolumeParameter[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load Resolume parameters");
      }

      setParameters(data.parameters ?? []);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not load Resolume parameters", "error");
      setParameters([]);
    } finally {
      setLoading(false);
    }
  }, [clip, layer, notify, scope]);

  useEffect(() => {
    loadParameters();
  }, [loadParameters]);

  useEffect(() => {
    async function loadEffects() {
      try {
        const response = await fetch("/api/resolume/effects", { cache: "no-store" });
        const data = (await response.json()) as { effects?: ResolumeEffect[] };
        setEffects(data.effects ?? []);
      } catch {
        setEffects([]);
      }
    }

    loadEffects();
  }, []);

  const grouped = useMemo(() => {
    return parameters.reduce<Record<ResolumeParameter["group"], ResolumeParameter[]>>(
      (accumulator, parameter) => {
        accumulator[parameter.group].push(parameter);
        return accumulator;
      },
      { transform: [], effect: [], audio: [], transport: [], other: [] }
    );
  }, [parameters]);

  async function updateParameter(parameter: ResolumeParameter, value: ResolumeParameterValue) {
    setSavingId(parameter.id);
    try {
      const response = await fetch("/api/resolume/parameters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: parameter.id, value })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Parameter update failed");
      }

      setParameters((current) => current.map((item) => (item.id === parameter.id ? { ...item, value } : item)));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Parameter update failed", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function addEffect() {
    try {
      const effect = effectInput.trim();
      if (!effect) {
        notify("Enter or choose an effect first", "error");
        return;
      }

      const response = await fetch("/api/resolume/effects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, layer, clip, effect })
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not add effect");
      }

      notify(data.message ?? "Effect added", "success");
      setEffectInput("");
      loadParameters();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not add effect", "error");
    }
  }

  async function removeEffect() {
    try {
      const response = await fetch("/api/resolume/effects", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, layer, clip, effectIndex: Number(removeIndex) })
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not remove effect");
      }

      notify(data.message ?? "Effect removed", "success");
      loadParameters();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not remove effect", "error");
    }
  }

  function toggleGroup(group: ResolumeParameter["group"]) {
    setOpenGroups((current) => ({ ...current, [group]: !current[group] }));
  }

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-sky-300">Advanced Resolume Controls</p>
          <h3 className="mt-1 text-xl font-black">Effects, transform, expand, and parameters</h3>
        </div>
        <div className="flex gap-2">
          {(["clip", "layer", "composition"] as ResolumeControlScope[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setScope(item)}
              className={`min-h-11 rounded-xl px-4 text-sm font-black capitalize ${scope === item ? "bg-sky-300 text-slate-950" : "bg-white/10"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03]">
        <button
          type="button"
          onClick={() => setEffectManagerOpen((value) => !value)}
          className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left"
        >
          <span>
            <span className="block text-sm font-black text-slate-100">Effect Manager</span>
            <span className="block text-xs text-slate-400">Add or remove effect slots when your Resolume API supports it</span>
          </span>
          <span className="rounded-xl bg-white/10 px-3 py-2 text-sm font-black">{effectManagerOpen ? "Hide" : "Show"}</span>
        </button>

        {effectManagerOpen && (
          <div className="space-y-3 border-t border-white/10 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                list="resolume-effects"
                value={effectInput}
                onChange={(event) => setEffectInput(event.target.value)}
                placeholder="Type effect name or id, e.g. Transform, Blur, Hue Rotate"
                className="min-h-12 rounded-2xl bg-slate-950 px-4 outline-none focus:ring-2 focus:ring-sky-300"
              />
              <datalist id="resolume-effects">
                {effects.map((effect) => (
                  <option key={effect.id} value={effect.id}>
                    {effect.name}
                  </option>
                ))}
              </datalist>
              <button type="button" onClick={addEffect} className="min-h-12 rounded-2xl bg-emerald-300 px-5 font-black text-slate-950">
                Add Effect
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                value={removeIndex}
                onChange={(event) => setRemoveIndex(event.target.value)}
                type="number"
                min="1"
                placeholder="Effect slot number"
                className="min-h-12 rounded-2xl bg-slate-950 px-4 outline-none focus:ring-2 focus:ring-sky-300"
              />
              <button type="button" onClick={removeEffect} className="min-h-12 rounded-2xl bg-rose-400/20 px-5 font-black text-rose-100">
                Remove Effect Slot
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-5 grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-white/10" />
          ))}
        </div>
      ) : parameters.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-white/20 p-4 text-sm text-slate-300">
          No editable parameters were found for this target. Try another scope, or confirm Resolume REST API is enabled.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {(Object.keys(GROUP_LABELS) as ResolumeParameter["group"][]).map((group) =>
            grouped[group].length > 0 ? (
              <div key={group} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="flex min-h-16 w-full items-center justify-between gap-4 px-4 text-left transition hover:bg-white/5"
                >
                  <span>
                    <span className="block text-base font-black text-slate-100">{GROUP_LABELS[group]}</span>
                    <span className="block text-xs text-slate-400">{grouped[group].length} controls</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-xl bg-slate-950 px-3 py-2 font-mono text-xs text-slate-300">{openGroups[group] ? "Open" : "Closed"}</span>
                    <span className="text-lg font-black">{openGroups[group] ? "-" : "+"}</span>
                  </span>
                </button>
                {openGroups[group] && (
                  <div className="grid gap-3 border-t border-white/10 p-3 md:grid-cols-2">
                    {grouped[group].slice(0, 24).map((parameter) => (
                      <ParameterControl key={parameter.id} parameter={parameter} disabled={savingId === parameter.id} onChange={(value) => updateParameter(parameter, value)} />
                    ))}
                    {grouped[group].length > 24 && <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300">Showing first 24 controls in this section.</div>}
                  </div>
                )}
              </div>
            ) : null
          )}
        </div>
      )}
    </section>
  );
}

function ParameterControl({
  parameter,
  disabled,
  onChange
}: {
  parameter: ResolumeParameter;
  disabled: boolean;
  onChange: (value: ResolumeParameterValue) => void;
}) {
  const value = parameter.value;
  const numericValue = typeof value === "number" ? value : Number(value);
  const isNumeric = Number.isFinite(numericValue);
  const min = parameter.min ?? 0;
  const max = parameter.max ?? (isNumeric && Math.abs(numericValue) > 1 ? Math.max(1, Math.ceil(Math.abs(numericValue) * 2)) : 1);

  return (
    <label className="rounded-2xl bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-bold text-slate-200" title={`${parameter.name} (${parameter.path})`}>
          {parameter.name}
        </span>
        <span className="rounded-lg bg-black/30 px-2 py-1 font-mono text-xs text-slate-300">{String(value ?? "-")}</span>
      </div>
      {typeof value === "boolean" ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(!value)}
          className={`mt-3 min-h-12 w-full rounded-xl font-black ${value ? "bg-emerald-300 text-slate-950" : "bg-white/10"}`}
        >
          {value ? "On" : "Off"}
        </button>
      ) : isNumeric ? (
        <input
          type="range"
          min={min}
          max={max}
          step={(max - min) / 200 || 0.01}
          value={numericValue}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mt-4 w-full accent-sky-300"
        />
      ) : (
        <input
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="mt-3 min-h-12 w-full rounded-xl bg-slate-950 px-3"
        />
      )}
    </label>
  );
}
