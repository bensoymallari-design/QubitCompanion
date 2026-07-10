"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import type { ResolumeOutputPreset, ResolumeParameter, ResolumeParameterValue } from "@/types/resolume";

export function OutputControlsPanel() {
  const [parameters, setParameters] = useState<ResolumeParameter[]>([]);
  const [presets, setPresets] = useState<ResolumeOutputPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { notify } = useToast();

  const selectedPreset = useMemo(() => presets.find((preset) => preset.id === selectedPresetId), [presets, selectedPresetId]);

  useEffect(() => {
    loadOutputState();
  }, []);

  async function loadOutputState() {
    setLoading(true);
    try {
      const [parametersResponse, presetsResponse] = await Promise.all([
        fetch("/api/resolume/output", { cache: "no-store" }),
        fetch("/api/resolume/output-presets", { cache: "no-store" })
      ]);
      const parametersData = (await parametersResponse.json()) as { parameters?: ResolumeParameter[]; error?: string };
      const presetsData = (await presetsResponse.json()) as { presets?: ResolumeOutputPreset[]; error?: string };

      if (!parametersResponse.ok) {
        throw new Error(parametersData.error ?? "Could not load output controls");
      }

      if (!presetsResponse.ok) {
        throw new Error(presetsData.error ?? "Could not load output presets");
      }

      setParameters(parametersData.parameters ?? []);
      setPresets(presetsData.presets ?? []);
      if (!selectedPresetId && presetsData.presets?.[0]) {
        setSelectedPresetId(presetsData.presets[0].id);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not load output controls", "error");
    } finally {
      setLoading(false);
    }
  }

  async function updateParameter(parameter: ResolumeParameter, value: ResolumeParameterValue) {
    setSavingId(parameter.id);
    try {
      const response = await fetch("/api/resolume/output", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: parameter.id, value })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not update output parameter");
      }

      setParameters((current) => current.map((item) => (item.id === parameter.id ? { ...item, value } : item)));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not update output parameter", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function savePreset() {
    const name = presetName.trim();

    if (!name) {
      notify("Enter a preset name first", "error");
      return;
    }

    try {
      const response = await fetch("/api/resolume/output-presets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          parameters: parameters.map((parameter) => ({
            id: parameter.id,
            name: parameter.name,
            path: parameter.path,
            value: parameter.value
          }))
        })
      });
      const data = (await response.json()) as { preset?: ResolumeOutputPreset; error?: string };

      if (!response.ok || !data.preset) {
        throw new Error(data.error ?? "Could not save output preset");
      }

      setPresets((current) => [data.preset as ResolumeOutputPreset, ...current]);
      setSelectedPresetId(data.preset.id);
      setPresetName("");
      notify("Output preset saved locally", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save output preset", "error");
    }
  }

  async function applyPreset() {
    if (!selectedPreset) {
      notify("Select an output preset first", "error");
      return;
    }

    setLoading(true);
    try {
      for (const parameter of selectedPreset.parameters) {
        await fetch("/api/resolume/output", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: parameter.id, value: parameter.value })
        }).then(async (response) => {
          if (!response.ok) {
            const data = (await response.json()) as { error?: string };
            throw new Error(data.error ?? `Could not apply ${parameter.name}`);
          }
        });
      }

      notify(`Applied output preset ${selectedPreset.name}`, "success");
      await loadOutputState();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not apply output preset", "error");
    } finally {
      setLoading(false);
    }
  }

  async function deletePreset() {
    if (!selectedPreset) {
      notify("Select an output preset first", "error");
      return;
    }

    if (!window.confirm(`Delete output preset "${selectedPreset.name}"?`)) {
      return;
    }

    try {
      const response = await fetch("/api/resolume/output-presets", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selectedPreset.id })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not delete output preset");
      }

      setPresets((current) => current.filter((preset) => preset.id !== selectedPreset.id));
      setSelectedPresetId("");
      notify("Output preset deleted", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not delete output preset", "error");
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-sky-300">Output Controls</p>
          <h2 className="mt-2 text-3xl font-black">Output parameters and local presets</h2>
          <p className="mt-2 max-w-3xl text-slate-300">
            Resolume does not expose full Advanced Output preset switching in many versions. This panel controls output/screen/device parameters that Resolume exposes and saves local presets for them.
          </p>
        </div>
        <button type="button" onClick={loadOutputState} disabled={loading} className="min-h-14 rounded-2xl bg-white/10 px-6 font-black disabled:opacity-50">
          {loading ? "Refreshing..." : "Refresh Output"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_auto_1fr_auto_auto]">
        <input
          value={presetName}
          onChange={(event) => setPresetName(event.target.value)}
          placeholder="Preset name, e.g. HDMI Main"
          className="min-h-14 rounded-2xl bg-slate-950 px-4"
        />
        <button type="button" onClick={savePreset} className="min-h-14 rounded-2xl bg-emerald-300 px-5 font-black text-slate-950">
          Save Preset
        </button>
        <select value={selectedPresetId} onChange={(event) => setSelectedPresetId(event.target.value)} className="min-h-14 rounded-2xl bg-slate-950 px-4">
          <option value="">Select saved output preset</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={applyPreset} disabled={loading || !selectedPresetId} className="min-h-14 rounded-2xl bg-sky-300 px-5 font-black text-slate-950 disabled:opacity-50">
          Apply
        </button>
        <button type="button" onClick={deletePreset} disabled={!selectedPresetId} className="min-h-14 rounded-2xl bg-rose-400/20 px-5 font-black text-rose-100 disabled:opacity-50">
          Delete
        </button>
      </div>

      {parameters.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/20 p-4 text-sm text-slate-300">
          No output/screen/device parameters were exposed by Resolume. Advanced Output screen/device preset switching may need to be changed inside Resolume manually.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {parameters.map((parameter) => (
            <OutputParameterControl
              key={parameter.id}
              parameter={parameter}
              disabled={savingId === parameter.id || loading}
              onChange={(value) => updateParameter(parameter, value)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function OutputParameterControl({
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
  const [draft, setDraft] = useState(String(value ?? ""));

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  function commit() {
    if (isNumeric) {
      const next = Number(draft);
      if (Number.isFinite(next)) {
        onChange(next);
      }
      return;
    }

    onChange(draft);
  }

  return (
    <label className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-slate-100" title={`${parameter.name} (${parameter.path})`}>
            {parameter.name}
          </span>
          <span className="mt-1 block truncate text-xs text-slate-500">{parameter.path}</span>
        </span>
        <span className="rounded-lg bg-black/30 px-2 py-1 font-mono text-xs text-slate-300">{String(value ?? "-")}</span>
      </div>

      {typeof value === "boolean" ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(!value)}
          className={`mt-3 min-h-12 w-full rounded-xl font-black ${value ? "bg-emerald-300 text-slate-950" : "bg-white/10"} disabled:opacity-50`}
        >
          {value ? "On" : "Off"}
        </button>
      ) : parameter.options && parameter.options.length > 0 ? (
        <select
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="mt-3 min-h-12 w-full rounded-xl bg-slate-950 px-3 disabled:opacity-50"
        >
          {parameter.options.map((option) => (
            <option key={`${parameter.id}-${String(option.value)}`} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <input
            type={isNumeric ? "number" : "text"}
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                commit();
                event.currentTarget.blur();
              }
            }}
            className="min-h-12 rounded-xl bg-slate-950 px-3 font-mono text-sm disabled:opacity-50"
          />
          <button type="button" disabled={disabled} onClick={commit} className="min-h-12 rounded-xl bg-sky-300 px-4 text-sm font-black text-slate-950 disabled:opacity-50">
            Set
          </button>
        </div>
      )}
    </label>
  );
}
