"use client";

import { useEffect, useState } from "react";
import { ResolumeAdvancedControls } from "@/components/ResolumeAdvancedControls";
import { useToast } from "@/components/ToastProvider";
import type { MediaFile } from "@/types/media";
import type { ResolumeClip, ResolumeLayer } from "@/types/resolume";
import type { AppSettings, ResolumeTarget } from "@/types/settings";

export function SendToResolumeDialog({ file, onClose }: { file: MediaFile; onClose: () => void }) {
  const [layers, setLayers] = useState<ResolumeLayer[]>([]);
  const [clips, setClips] = useState<ResolumeClip[]>([]);
  const [targets, setTargets] = useState<ResolumeTarget[]>([]);
  const [targetId, setTargetId] = useState("");
  const [layer, setLayer] = useState(1);
  const [clip, setClip] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [triggerAfterLoad, setTriggerAfterLoad] = useState(true);
  const { notify } = useToast();

  useEffect(() => {
    async function loadTargetSettings() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        const data = (await response.json()) as { settings?: AppSettings };
        const nextTargets = data.settings?.resolumeTargets ?? [];
        setTargets(nextTargets);
        setTargetId((current) => current || nextTargets[0]?.id || "");
      } catch {
        setTargets([]);
      }
    }

    loadTargetSettings();
  }, []);

  useEffect(() => {
    async function loadResolumeTargets() {
      try {
        const params = targetId ? `?targetId=${encodeURIComponent(targetId)}` : "";
        const [layersResponse, clipsResponse] = await Promise.all([fetch(`/api/resolume/layers${params}`), fetch(`/api/resolume/clips${params}`)]);
        const layersData = (await layersResponse.json()) as { layers?: ResolumeLayer[] };
        const clipsData = (await clipsResponse.json()) as { clips?: ResolumeClip[] };
        setLayers(layersData.layers ?? []);
        setClips(clipsData.clips ?? []);
      } catch {
        setLayers([]);
        setClips([]);
      }
    }

    loadResolumeTargets();
  }, [targetId]);

  useEffect(() => {
    setClip(1);
  }, [layer]);

  async function send() {
    setLoading(true);
    setLoadingMessage(triggerAfterLoad ? "Loading media into Resolume, then triggering the clip. Please wait..." : "Loading media into Resolume. Please wait...");
    try {
      const response = await fetch("/api/resolume/load", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileId: file.id, layer, clip, trigger: triggerAfterLoad, targetId })
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Resolume load failed");
      }

      notify(data.message ?? (triggerAfterLoad ? "Loaded and triggered media in Resolume" : "Loaded media into Resolume"), "success");
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Resolume load failed", "error");
    } finally {
      setLoading(false);
      setLoadingMessage("");
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
          <button type="button" onClick={onClose} disabled={loading} className="min-h-12 rounded-2xl bg-white/10 px-4 font-black disabled:cursor-not-allowed disabled:opacity-40">
            Close
          </button>
        </div>

        {loading && (
          <div className="mt-5 rounded-3xl border border-emerald-300/30 bg-emerald-300/10 p-5">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 shrink-0 animate-spin rounded-full border-4 border-emerald-200/30 border-t-emerald-200" />
              <div>
                <p className="text-lg font-black text-emerald-100">Please wait</p>
                <p className="mt-1 text-sm text-emerald-50/80">{loadingMessage}</p>
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/30">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-300" />
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-bold text-slate-300">Resolume Target</span>
            <select value={targetId} disabled={loading} onChange={(event) => setTargetId(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl bg-slate-950 px-4 disabled:cursor-not-allowed disabled:opacity-50">
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name} - {target.ip}:{target.port}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-300">Layer</span>
            <select value={layer} disabled={loading} onChange={(event) => setLayer(Number(event.target.value))} className="mt-2 min-h-14 w-full rounded-2xl bg-slate-950 px-4 disabled:cursor-not-allowed disabled:opacity-50">
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
            <select value={clip} disabled={loading} onChange={(event) => setClip(Number(event.target.value))} className="mt-2 min-h-14 w-full rounded-2xl bg-slate-950 px-4 disabled:cursor-not-allowed disabled:opacity-50">
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
          <input type="checkbox" checked={triggerAfterLoad} disabled={loading} onChange={(event) => setTriggerAfterLoad(event.target.checked)} className="h-6 w-6 disabled:opacity-50" />
        </label>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button type="button" disabled={loading} onClick={send} className="min-h-16 rounded-2xl bg-emerald-300 px-5 text-lg font-black text-slate-950 disabled:opacity-50">
            {loading ? "Loading..." : triggerAfterLoad ? "Load & Trigger" : "Load"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              try {
                await postResolumeAction("/api/resolume/trigger", { layer, clip, targetId });
                notify("Clip triggered", "success");
              } catch (error) {
                notify(error instanceof Error ? error.message : "Trigger failed", "error");
              }
            }}
            className="min-h-16 rounded-2xl bg-white/10 px-5 text-lg font-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            Trigger
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              try {
                await postResolumeAction("/api/resolume/stop", { layer, clip, targetId });
                notify("Clip stopped", "info");
              } catch (error) {
                notify(error instanceof Error ? error.message : "Stop failed", "error");
              }
            }}
            className="min-h-16 rounded-2xl bg-white/10 px-5 text-lg font-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            Stop
          </button>
        </div>

        <ResolumeAdvancedControls layer={layer} clip={clip} targetId={targetId} />
      </div>
    </div>
  );
}

async function postResolumeAction(url: string, body: { layer: number; clip: number; targetId?: string }) {
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
