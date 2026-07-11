"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import type { NdiPreset, NdiTransformValues, ResolumeClip, ResolumeLayer, ResolumeParameter, ResolumeSource } from "@/types/resolume";

export function NdiSourcePanel() {
  const [sources, setSources] = useState<ResolumeSource[]>([]);
  const [layers, setLayers] = useState<ResolumeLayer[]>([]);
  const [clips, setClips] = useState<ResolumeClip[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [manualName, setManualName] = useState("");
  const [ndiPresets, setNdiPresets] = useState<NdiPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [layer, setLayer] = useState(1);
  const [clip, setClip] = useState(1);
  const [transformX, setTransformX] = useState("0");
  const [transformY, setTransformY] = useState("0");
  const [transformWidth, setTransformWidth] = useState("1920");
  const [transformHeight, setTransformHeight] = useState("1080");
  const [transformOpacity, setTransformOpacity] = useState("100");
  const [compositionWidth, setCompositionWidth] = useState("1920");
  const [compositionHeight, setCompositionHeight] = useState("1080");
  const [trigger, setTrigger] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingSources, setLoadingSources] = useState(false);
  const { notify } = useToast();

  const selectedSource = useMemo(() => sources.find((source) => source.id === selectedSourceId), [selectedSourceId, sources]);
  const selectedPreset = useMemo(() => ndiPresets.find((preset) => preset.id === selectedPresetId), [ndiPresets, selectedPresetId]);
  const filteredClips = clips.filter((item) => Number(item.layerId) === layer);

  useEffect(() => {
    loadTargets();
    loadSources();
    loadNdiPresets();
  }, []);

  useEffect(() => {
    setClip(1);
  }, [layer]);

  async function loadTargets() {
    try {
      const [layersResponse, clipsResponse] = await Promise.all([fetch("/api/resolume/layers"), fetch("/api/resolume/clips")]);
      const layersData = (await layersResponse.json()) as { layers?: ResolumeLayer[] };
      const clipsData = (await clipsResponse.json()) as { clips?: ResolumeClip[] };
      setLayers(layersData.layers ?? []);
      setClips(clipsData.clips ?? []);
    } catch {
      setLayers([]);
      setClips([]);
    }
  }

  async function loadSources() {
    setLoadingSources(true);
    try {
      const response = await fetch("/api/resolume/sources?ndi=true", { cache: "no-store" });
      const data = (await response.json()) as { sources?: ResolumeSource[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load Resolume sources");
      }

      setSources(data.sources ?? []);
      if (!selectedSourceId && data.sources?.[0]) {
        setSelectedSourceId(data.sources[0].id);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not load Resolume sources", "error");
    } finally {
      setLoadingSources(false);
    }
  }

  async function loadNdiPresets() {
    try {
      const response = await fetch("/api/resolume/ndi-presets", { cache: "no-store" });
      const data = (await response.json()) as { presets?: NdiPreset[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load NDI presets");
      }

      setNdiPresets(data.presets ?? []);
      if (!selectedPresetId && data.presets?.[0]) {
        setSelectedPresetId(data.presets[0].id);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not load NDI presets", "error");
    }
  }

  async function loadSource() {
    const source = selectedSource ?? manualSource(manualName);

    if (!source) {
      notify("Select an NDI source or enter a manual NDI source name.", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/resolume/source-load", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, layer, clip, trigger })
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load NDI source");
      }

      notify(data.message ?? "NDI source loaded", "success");
      await applyTransformValues(currentTransformValues(), layer, clip, "NDI transform applied", { scale100: true }).catch((error) => {
        notify(error instanceof Error ? error.message : "NDI loaded, but transform was not applied", "error");
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not load NDI source", "error");
    } finally {
      setLoading(false);
    }
  }

  async function clearSelectedClip() {
    setLoading(true);
    try {
      const response = await fetch("/api/resolume/clear-clip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ layer, clip })
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not remove NDI source");
      }

      notify(data.message ?? "NDI source removed from clip", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not remove NDI source", "error");
    } finally {
      setLoading(false);
    }
  }

  async function applyTransformPreset(preset: "fit" | "center" | "scale100") {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope: "clip", layer: String(layer), clip: String(clip) });
      const response = await fetch(`/api/resolume/parameters?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as { parameters?: ResolumeParameter[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not read clip transform controls");
      }

      const transformParameters = (data.parameters ?? []).filter((parameter) => parameter.group === "transform");
      const updates = transformPresetUpdates(transformParameters, preset, Number(compositionWidth), Number(compositionHeight));

      if (updates.length === 0) {
        throw new Error("No matching transform parameters were found for this NDI clip.");
      }

      for (const update of updates) {
        const updateResponse = await fetch("/api/resolume/parameters", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: update.parameter.id, value: update.value })
        });
        const updateData = (await updateResponse.json()) as { error?: string };

        if (!updateResponse.ok) {
          throw new Error(updateData.error ?? `Could not update ${update.parameter.name}`);
        }
      }

      notify(`Updated ${updates.length} NDI transform control${updates.length === 1 ? "" : "s"}`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not update NDI transform", "error");
    } finally {
      setLoading(false);
    }
  }

  async function applyManualTransform() {
    setLoading(true);
    try {
      await applyTransformValues(currentTransformValues(), layer, clip, "NDI transform updated");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not update NDI transform", "error");
    } finally {
      setLoading(false);
    }
  }

  async function saveCurrentNdiPreset() {
    const source = selectedSource ?? manualSource(manualName);
    const name = presetName.trim();

    if (!source) {
      notify("Select an NDI source or enter a manual NDI source name before saving.", "error");
      return;
    }

    if (!name) {
      notify("Enter an NDI preset name first.", "error");
      return;
    }

    try {
      const response = await fetch("/api/resolume/ndi-presets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          source,
          layer,
          clip,
          trigger,
          compositionWidth: numberOrUndefined(compositionWidth),
          compositionHeight: numberOrUndefined(compositionHeight),
          transform: currentTransformValues()
        })
      });
      const data = (await response.json()) as { preset?: NdiPreset; error?: string };

      if (!response.ok || !data.preset) {
        throw new Error(data.error ?? "Could not save NDI preset");
      }

      setNdiPresets((current) => [data.preset as NdiPreset, ...current]);
      setSelectedPresetId(data.preset.id);
      setPresetName("");
      notify("NDI preset saved", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save NDI preset", "error");
    }
  }

  async function applySelectedNdiPreset() {
    if (!selectedPreset) {
      notify("Select an NDI preset first.", "error");
      return;
    }

    setLoading(true);
    try {
      await fetch("/api/resolume/clear-clip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ layer: selectedPreset.layer, clip: selectedPreset.clip })
      }).catch(() => undefined);

      setLayer(selectedPreset.layer);
      setClip(selectedPreset.clip);
      setTrigger(selectedPreset.trigger);
      setCompositionWidth(String(selectedPreset.compositionWidth ?? compositionWidth));
      setCompositionHeight(String(selectedPreset.compositionHeight ?? compositionHeight));
      setTransformInputs(selectedPreset.transform);
      setManualName(selectedPreset.source.name);
      setSelectedSourceId("");

      const response = await fetch("/api/resolume/source-load", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: selectedPreset.source,
          layer: selectedPreset.layer,
          clip: selectedPreset.clip,
          trigger: selectedPreset.trigger
        })
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load NDI preset source");
      }

      await applyTransformValues(selectedPreset.transform, selectedPreset.layer, selectedPreset.clip, `Applied NDI preset ${selectedPreset.name}`, { scale100: true });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not apply NDI preset", "error");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelectedNdiPreset() {
    if (!selectedPreset) {
      notify("Select an NDI preset first.", "error");
      return;
    }

    if (!window.confirm(`Delete NDI preset "${selectedPreset.name}"?`)) {
      return;
    }

    try {
      const response = await fetch("/api/resolume/ndi-presets", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selectedPreset.id })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not delete NDI preset");
      }

      setNdiPresets((current) => current.filter((preset) => preset.id !== selectedPreset.id));
      setSelectedPresetId("");
      notify("NDI preset deleted", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not delete NDI preset", "error");
    }
  }

  async function applyTransformValues(
    values: NdiTransformValues,
    targetLayer: number,
    targetClip: number,
    successMessage: string,
    options: { scale100?: boolean } = {}
  ) {
    const params = new URLSearchParams({ scope: "clip", layer: String(targetLayer), clip: String(targetClip) });
    const response = await fetch(`/api/resolume/parameters?${params.toString()}`, { cache: "no-store" });
    const data = (await response.json()) as { parameters?: ResolumeParameter[]; error?: string };

    if (!response.ok) {
      throw new Error(data.error ?? "Could not read NDI transform controls");
    }

    const allParameters = data.parameters ?? [];
    const updates = dedupeUpdates([
      ...transformValueUpdates(allParameters.filter((parameter) => parameter.group === "transform"), values),
      ...opacityValueUpdates(allParameters, values.opacity),
      ...(options.scale100 ? scale100Updates(allParameters) : [])
    ]);

    if (updates.length === 0) {
      throw new Error("No matching transform, opacity, or scale parameters were found for this NDI clip.");
    }

    for (const update of updates) {
      const updateResponse = await fetch("/api/resolume/parameters", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: update.parameter.id, value: update.value })
      });
      const updateData = (await updateResponse.json()) as { error?: string };

      if (!updateResponse.ok) {
        throw new Error(updateData.error ?? `Could not update ${update.parameter.name}`);
      }
    }

    notify(successMessage, "success");
  }

  function currentTransformValues(): NdiTransformValues {
    return {
      x: numberOrUndefined(transformX),
      y: numberOrUndefined(transformY),
      width: numberOrUndefined(transformWidth),
      height: numberOrUndefined(transformHeight),
      opacity: numberOrUndefined(transformOpacity)
    };
  }

  function setTransformInputs(values: NdiTransformValues) {
    setTransformX(String(values.x ?? 0));
    setTransformY(String(values.y ?? 0));
    setTransformWidth(String(values.width ?? compositionWidth));
    setTransformHeight(String(values.height ?? compositionHeight));
    setTransformOpacity(String(values.opacity ?? 100));
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-sky-300">NDI Sources</p>
          <h2 className="mt-2 text-3xl font-black">Load network video into Resolume</h2>
          <p className="mt-2 max-w-3xl text-slate-300">
            Start OBS/NDI on the same LAN, refresh sources, then choose a layer and clip. The app asks Resolume on this PC to open the NDI source.
          </p>
        </div>
        <button type="button" onClick={loadSources} disabled={loadingSources} className="min-h-14 rounded-2xl bg-white/10 px-6 font-black disabled:opacity-50">
          {loadingSources ? "Refreshing..." : "Refresh Sources"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="text-sm font-bold text-slate-300">Available NDI Source</span>
          <select
            value={selectedSourceId}
            onChange={(event) => setSelectedSourceId(event.target.value)}
            className="mt-2 min-h-14 w-full rounded-2xl bg-slate-950 px-4"
          >
            <option value="">Manual source name</option>
            {sources.map((source) => (
              <option key={`${source.id}-${source.path ?? ""}`} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-bold text-slate-300">Manual NDI Name</span>
          <input
            value={manualName}
            onChange={(event) => {
              setManualName(event.target.value);
              setSelectedSourceId("");
            }}
            placeholder="PC-NAME (OBS)"
            className="mt-2 min-h-14 w-full rounded-2xl bg-slate-950 px-4"
          />
        </label>

        <label className="flex min-h-14 items-center justify-between gap-4 rounded-2xl bg-white/5 px-5 font-bold xl:mt-7">
          Trigger after load
          <input type="checkbox" checked={trigger} onChange={(event) => setTrigger(event.target.checked)} className="h-6 w-6" />
        </label>
      </div>

      <div className="mt-5 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-200">NDI Presets</p>
        <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_auto_1fr_auto_auto]">
          <input
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder="Preset name, e.g. Lobby NDI Fullscreen"
            className="min-h-12 rounded-2xl bg-slate-950 px-4"
          />
          <button type="button" disabled={loading} onClick={saveCurrentNdiPreset} className="min-h-12 rounded-2xl bg-emerald-300 px-5 font-black text-slate-950 disabled:opacity-50">
            Save NDI Preset
          </button>
          <select value={selectedPresetId} onChange={(event) => setSelectedPresetId(event.target.value)} className="min-h-12 rounded-2xl bg-slate-950 px-4">
            <option value="">Select saved NDI preset</option>
            {ndiPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <button type="button" disabled={loading || !selectedPresetId} onClick={applySelectedNdiPreset} className="min-h-12 rounded-2xl bg-sky-300 px-5 font-black text-slate-950 disabled:opacity-50">
            Apply Preset
          </button>
          <button type="button" disabled={!selectedPresetId} onClick={deleteSelectedNdiPreset} className="min-h-12 rounded-2xl bg-rose-400/20 px-5 font-black text-rose-100 disabled:opacity-50">
            Delete
          </button>
        </div>
        <p className="mt-3 text-xs text-emerald-50/80">Presets save the NDI source, layer, clip, trigger option, composition size, and X/Y/width/height transform values.</p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="text-sm font-bold text-slate-300">Layer</span>
          <select value={layer} onChange={(event) => setLayer(Number(event.target.value))} className="mt-2 min-h-14 w-full rounded-2xl bg-slate-950 px-4">
            {layers.length > 0
              ? layers.map((item, index) => (
                  <option key={String(item.id)} value={index + 1}>
                    {item.name}
                  </option>
                ))
              : Array.from({ length: 8 }).map((_, index) => (
                  <option key={index + 1} value={index + 1}>
                    Layer {index + 1}
                  </option>
                ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-bold text-slate-300">Clip</span>
          <select value={clip} onChange={(event) => setClip(Number(event.target.value))} className="mt-2 min-h-14 w-full rounded-2xl bg-slate-950 px-4">
            {filteredClips.length > 0
              ? filteredClips.map((item, index) => (
                  <option key={String(item.id)} value={index + 1}>
                    {item.name}
                  </option>
                ))
              : Array.from({ length: 16 }).map((_, index) => (
                  <option key={index + 1} value={index + 1}>
                    Clip {index + 1}
                  </option>
                ))}
          </select>
        </label>

        <button type="button" onClick={loadSource} disabled={loading} className="min-h-14 rounded-2xl bg-emerald-300 px-6 font-black text-slate-950 disabled:opacity-50 md:mt-7">
          {loading ? "Loading NDI..." : trigger ? "Load & Trigger NDI" : "Load NDI"}
        </button>
      </div>

      <div className="mt-5 rounded-3xl border border-sky-300/20 bg-sky-300/10 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-sky-200">X Position</span>
              <input
                type="number"
                value={transformX}
                onChange={(event) => setTransformX(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl bg-slate-950 px-4 text-lg font-bold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-sky-200">Y Position</span>
              <input
                type="number"
                value={transformY}
                onChange={(event) => setTransformY(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl bg-slate-950 px-4 text-lg font-bold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-sky-200">Width</span>
              <input
                type="number"
                min="1"
                value={transformWidth}
                onChange={(event) => {
                  setTransformWidth(event.target.value);
                  setCompositionWidth(event.target.value);
                }}
                className="mt-2 min-h-12 w-full rounded-2xl bg-slate-950 px-4 text-lg font-bold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-sky-200">Height</span>
              <input
                type="number"
                min="1"
                value={transformHeight}
                onChange={(event) => {
                  setTransformHeight(event.target.value);
                  setCompositionHeight(event.target.value);
                }}
                className="mt-2 min-h-12 w-full rounded-2xl bg-slate-950 px-4 text-lg font-bold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-sky-200">Opacity %</span>
              <input
                type="number"
                min="0"
                max="100"
                value={transformOpacity}
                onChange={(event) => setTransformOpacity(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl bg-slate-950 px-4 text-lg font-bold"
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-5 xl:w-[46rem]">
            <button type="button" disabled={loading} onClick={applyManualTransform} className="min-h-12 rounded-2xl bg-emerald-300 px-4 font-black text-slate-950 disabled:opacity-50">
              Apply Values
            </button>
            <button type="button" disabled={loading} onClick={() => applyTransformPreset("fit")} className="min-h-12 rounded-2xl bg-sky-300 px-4 font-black text-slate-950 disabled:opacity-50">
              Fit Size
            </button>
            <button type="button" disabled={loading} onClick={() => applyTransformPreset("center")} className="min-h-12 rounded-2xl bg-white/10 px-4 font-black disabled:opacity-50">
              Center
            </button>
            <button type="button" disabled={loading} onClick={() => applyTransformPreset("scale100")} className="min-h-12 rounded-2xl bg-white/10 px-4 font-black disabled:opacity-50">
              Scale 100%
            </button>
            <button type="button" disabled={loading} onClick={clearSelectedClip} className="min-h-12 rounded-2xl bg-rose-400/20 px-4 font-black text-rose-100 disabled:opacity-50">
              Remove NDI
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-300">
          Enter exact X/Y/width/height/opacity values and apply them to matching parameters on the selected NDI clip. Loading or applying an NDI preset also resets scale to 100%. Remove NDI clears the selected clip slot.
        </p>
      </div>

      {sources.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed border-white/20 p-4 text-sm text-slate-300">
          No NDI sources were reported by Resolume yet. Make sure the sender is active on the LAN and visible in Resolume's Sources panel, then refresh.
        </p>
      )}
    </section>
  );
}

function transformPresetUpdates(parameters: ResolumeParameter[], preset: "fit" | "center" | "scale100", width: number, height: number) {
  const updates: Array<{ parameter: ResolumeParameter; value: number }> = [];

  for (const parameter of parameters) {
    const key = `${parameter.path} ${parameter.name}`.toLowerCase();

    if (preset === "fit") {
      if (Number.isFinite(width) && /\b(width|size x|resolution x)\b/.test(key)) {
        updates.push({ parameter, value: width });
      } else if (Number.isFinite(height) && /\b(height|size y|resolution y)\b/.test(key)) {
        updates.push({ parameter, value: height });
      } else if (/\b(scale|scale x|scale y)\b/.test(key)) {
        updates.push({ parameter, value: scaleOneValue(parameter) });
      }
    }

    if (preset === "center") {
      if (Number.isFinite(width) && /(position x|pos x|translate x|anchor x)/.test(key)) {
        updates.push({ parameter, value: width / 2 });
      } else if (Number.isFinite(height) && /(position y|pos y|translate y|anchor y)/.test(key)) {
        updates.push({ parameter, value: height / 2 });
      }
    }

    if (preset === "scale100" && /\b(scale|scale x|scale y)\b/.test(key)) {
      updates.push({ parameter, value: scaleOneValue(parameter) });
    }
  }

  return updates;
}

function transformValueUpdates(parameters: ResolumeParameter[], values: NdiTransformValues) {
  const updates: Array<{ parameter: ResolumeParameter; value: number }> = [];

  for (const parameter of parameters) {
    const key = `${parameter.path} ${parameter.name}`.toLowerCase();

    if (typeof values.x === "number" && /(position x|pos x|translate x|anchor x)/.test(key)) {
      updates.push({ parameter, value: values.x });
      continue;
    }

    if (typeof values.y === "number" && /(position y|pos y|translate y|anchor y)/.test(key)) {
      updates.push({ parameter, value: values.y });
      continue;
    }

    if (typeof values.width === "number" && /\b(width|size x|resolution x|w)\b/.test(key)) {
      updates.push({ parameter, value: values.width });
      continue;
    }

    if (typeof values.height === "number" && /\b(height|size y|resolution y|h)\b/.test(key)) {
      updates.push({ parameter, value: values.height });
    }
  }

  return updates;
}

function opacityValueUpdates(parameters: ResolumeParameter[], opacity: number | undefined) {
  if (typeof opacity !== "number") {
    return [];
  }

  return parameters
    .filter((parameter) => {
      const key = `${parameter.path} ${parameter.name}`.toLowerCase();
      return /opacity|alpha/.test(key);
    })
    .map((parameter) => ({ parameter, value: opacityToParameterValue(parameter, opacity) }));
}

function scale100Updates(parameters: ResolumeParameter[]) {
  return parameters
    .filter((parameter) => {
      const key = `${parameter.path} ${parameter.name}`.toLowerCase();
      return /\b(scale|scale x|scale y)\b/.test(key);
    })
    .map((parameter) => ({ parameter, value: scaleOneValue(parameter) }));
}

function dedupeUpdates(updates: Array<{ parameter: ResolumeParameter; value: number }>) {
  const seen = new Set<string>();
  return updates.filter((update) => {
    if (seen.has(update.parameter.id)) {
      return false;
    }
    seen.add(update.parameter.id);
    return true;
  });
}

function opacityToParameterValue(parameter: ResolumeParameter, opacityPercent: number): number {
  const clamped = Math.max(0, Math.min(100, opacityPercent));

  if (typeof parameter.max === "number") {
    if (parameter.max <= 1) {
      return clamped / 100;
    }

    if (parameter.max === 100) {
      return clamped;
    }

    return (clamped / 100) * parameter.max;
  }

  const current = typeof parameter.value === "number" ? parameter.value : Number(parameter.value);
  return Number.isFinite(current) && current <= 1 ? clamped / 100 : clamped;
}

function numberOrUndefined(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function scaleOneValue(parameter: ResolumeParameter): number {
  if (typeof parameter.max === "number" && parameter.max > 2) {
    return 100;
  }

  return 1;
}

function manualSource(name: string): ResolumeSource | null {
  const trimmed = name.trim();

  if (!trimmed) {
    return null;
  }

  return {
    id: `manual:${trimmed}`,
    name: trimmed,
    type: "ndi",
    isNdi: true
  };
}
