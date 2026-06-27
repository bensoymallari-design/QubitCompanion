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

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
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

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
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
        <div className="mt-5 space-y-5">
          {(Object.keys(GROUP_LABELS) as ResolumeParameter["group"][]).map((group) =>
            grouped[group].length > 0 ? (
              <div key={group}>
                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">{GROUP_LABELS[group]}</h4>
                <div className="mt-3 grid gap-3">
                  {grouped[group].slice(0, 24).map((parameter) => (
                    <ParameterControl key={parameter.id} parameter={parameter} disabled={savingId === parameter.id} onChange={(value) => updateParameter(parameter, value)} />
                  ))}
                </div>
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
