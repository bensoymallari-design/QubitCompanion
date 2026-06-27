"use client";

import { useEffect, useState } from "react";
import { ResolumeAdvancedControls } from "@/components/ResolumeAdvancedControls";
import { useToast } from "@/components/ToastProvider";
import type { MediaFile } from "@/types/media";
import type { ResolumeClip, ResolumeLayer } from "@/types/resolume";

export function SendToResolumeDialog({ file, onClose }: { file: MediaFile; onClose: () => void }) {
  const [layers, setLayers] = useState<ResolumeLayer[]>([]);
  const [clips, setClips] = useState<ResolumeClip[]>([]);
  const [layer, setLayer] = useState(1);
  const [clip, setClip] = useState(1);
  const [loading, setLoading] = useState(false);
  const [triggerAfterLoad, setTriggerAfterLoad] = useState(true);
  const { notify } = useToast();

  useEffect(() => {
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

    loadTargets();
  }, []);

  useEffect(() => {
    setClip(1);
  }, [layer]);

  async function send() {
    setLoading(true);
    try {
      const response = await fetch("/api/resolume/load", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileId: file.id, layer, clip })
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Resolume load failed");
      }

      if (triggerAfterLoad) {
        await postResolumeAction("/api/resolume/trigger", { layer, clip });
      }

      notify(triggerAfterLoad ? "Loaded and triggered media in Resolume" : data.message ?? "Loaded media into Resolume", "success");
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Resolume load failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-300">Send to Resolume</p>
            <h2 className="mt-2 text-3xl font-black">{file.filename}</h2>
          </div>
          <button type="button" onClick={onClose} className="min-h-12 rounded-2xl bg-white/10 px-4 font-black">
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
              {clips.filter((item) => Number(item.layerId) === layer).length > 0
                ? clips
                    .filter((item) => Number(item.layerId) === layer)
                    .map((item, index) => (
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
        </div>

        <label className="mt-5 flex min-h-14 items-center justify-between rounded-2xl bg-white/5 px-5 text-base font-bold">
          Trigger clip after loading
          <input type="checkbox" checked={triggerAfterLoad} onChange={(event) => setTriggerAfterLoad(event.target.checked)} className="h-6 w-6" />
        </label>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button type="button" disabled={loading} onClick={send} className="min-h-16 rounded-2xl bg-emerald-300 px-5 text-lg font-black text-slate-950 disabled:opacity-50">
            {loading ? "Loading..." : triggerAfterLoad ? "Load & Trigger" : "Load"}
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await postResolumeAction("/api/resolume/trigger", { layer, clip });
                notify("Clip triggered", "success");
              } catch (error) {
                notify(error instanceof Error ? error.message : "Trigger failed", "error");
              }
            }}
            className="min-h-16 rounded-2xl bg-white/10 px-5 text-lg font-black"
          >
            Trigger
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await postResolumeAction("/api/resolume/stop", { layer, clip });
                notify("Clip stopped", "info");
              } catch (error) {
                notify(error instanceof Error ? error.message : "Stop failed", "error");
              }
            }}
            className="min-h-16 rounded-2xl bg-white/10 px-5 text-lg font-black"
          >
            Stop
          </button>
        </div>

        <ResolumeAdvancedControls layer={layer} clip={clip} />
      </div>
    </div>
  );
}

async function postResolumeAction(url: string, body: { layer: number; clip: number }) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Resolume action failed");
  }
}
