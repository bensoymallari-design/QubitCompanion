"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import type { ResolumeClip, ResolumeLayer, ResolumeSource } from "@/types/resolume";

export function NdiSourcePanel() {
  const [sources, setSources] = useState<ResolumeSource[]>([]);
  const [layers, setLayers] = useState<ResolumeLayer[]>([]);
  const [clips, setClips] = useState<ResolumeClip[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [manualName, setManualName] = useState("");
  const [layer, setLayer] = useState(1);
  const [clip, setClip] = useState(1);
  const [trigger, setTrigger] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingSources, setLoadingSources] = useState(false);
  const { notify } = useToast();

  const selectedSource = useMemo(() => sources.find((source) => source.id === selectedSourceId), [selectedSourceId, sources]);
  const filteredClips = clips.filter((item) => Number(item.layerId) === layer);

  useEffect(() => {
    loadTargets();
    loadSources();
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
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not load NDI source", "error");
    } finally {
      setLoading(false);
    }
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

      {sources.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed border-white/20 p-4 text-sm text-slate-300">
          No NDI sources were reported by Resolume yet. Make sure the sender is active on the LAN and visible in Resolume's Sources panel, then refresh.
        </p>
      )}
    </section>
  );
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
