"use client";

import { useRef, useState } from "react";
import { SendToResolumeDialog } from "@/components/SendToResolumeDialog";
import { useToast } from "@/components/ToastProvider";
import type { MediaFile } from "@/types/media";
import { formatBytes, formatDate } from "@/utils/format";

interface MediaCardProps {
  file: MediaFile;
  onChanged: () => void;
}

export function MediaCard({ file, onChanged }: MediaCardProps) {
  const [sendOpen, setSendOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  async function update(body: Record<string, unknown>) {
    const response = await fetch(`/api/files/${file.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "File update failed");
    }
    onChanged();
  }

  async function rename() {
    const next = window.prompt("Rename file", file.filename);
    if (!next || next === file.filename) {
      return;
    }

    try {
      await update({ filename: next });
      notify("File renamed", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Rename failed", "error");
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${file.filename}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Delete failed");
      }
      notify("File deleted", "success");
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Delete failed", "error");
    }
  }

  async function duplicate() {
    try {
      const response = await fetch(`/api/files/${file.id}/duplicate`, { method: "POST" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Duplicate failed");
      }
      notify("File duplicated", "success");
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Duplicate failed", "error");
    }
  }

  async function replace(replacement: File) {
    const form = new FormData();
    form.append("file", replacement);
    try {
      const response = await fetch(`/api/files/${file.id}/replace`, { method: "POST", body: form });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Replace failed");
      }
      notify("File replaced", "success");
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Replace failed", "error");
    } finally {
      if (replaceRef.current) {
        replaceRef.current.value = "";
      }
    }
  }

  async function copyPath() {
    const absolute = `${window.location.origin}/api/files/${file.id}/raw`;
    await navigator.clipboard.writeText(absolute);
    notify("Media URL copied", "success");
  }

  return (
    <article className="group rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/10">
      <button type="button" onClick={() => setPreviewOpen(true)} className="block w-full overflow-hidden rounded-2xl bg-slate-950">
        <img src={`/api/files/${file.id}/thumbnail`} alt={file.filename} loading="lazy" className="aspect-video w-full object-cover transition group-hover:scale-105" />
      </button>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-black">{file.filename}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {formatBytes(file.size)} - {formatDate(file.createdAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => update({ favorite: !file.favorite }).then(() => notify(file.favorite ? "Removed favorite" : "Marked favorite", "success"))}
          className={`min-h-12 min-w-12 rounded-2xl text-lg font-black ${file.favorite ? "bg-amber-300 text-slate-950" : "bg-white/10"}`}
          aria-label="Toggle favorite"
        >
          {file.favorite ? "*" : "+"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setPreviewOpen(true)} className="min-h-12 rounded-2xl bg-white/10 font-bold">
          Preview
        </button>
        <button type="button" onClick={() => setSendOpen(true)} className="min-h-12 rounded-2xl bg-sky-300 font-black text-slate-950">
          Send
        </button>
        <button type="button" onClick={rename} className="min-h-12 rounded-2xl bg-white/10 font-bold">
          Rename
        </button>
        <button type="button" onClick={duplicate} className="min-h-12 rounded-2xl bg-white/10 font-bold">
          Duplicate
        </button>
        <button type="button" onClick={copyPath} className="min-h-12 rounded-2xl bg-white/10 font-bold">
          Copy Path
        </button>
        <button type="button" onClick={remove} className="min-h-12 rounded-2xl bg-rose-400/20 font-bold text-rose-100">
          Delete
        </button>
      </div>

      <input
        ref={replaceRef}
        type="file"
        accept=".png,.jpg,.jpeg,.gif,.mp4,.mov,.webm,image/png,image/jpeg,image/gif,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(event) => event.target.files?.[0] && replace(event.target.files[0])}
      />
      <button type="button" onClick={() => replaceRef.current?.click()} className="mt-3 min-h-12 w-full rounded-2xl border border-white/10 font-bold">
        Replace File
      </button>

      {sendOpen && <SendToResolumeDialog file={file} onClose={() => setSendOpen(false)} />}
      {previewOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur">
          <div className="w-full max-w-5xl rounded-[2rem] border border-white/10 bg-slate-900 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="truncate text-2xl font-black">{file.filename}</h2>
              <button type="button" onClick={() => setPreviewOpen(false)} className="min-h-12 rounded-2xl bg-white/10 px-5 font-black">
                Close
              </button>
            </div>
            {file.kind === "video" ? (
              <video src={`/api/files/${file.id}/raw`} controls autoPlay className="max-h-[70vh] w-full rounded-2xl bg-black" />
            ) : (
              <img src={`/api/files/${file.id}/raw`} alt={file.filename} className="max-h-[70vh] w-full rounded-2xl object-contain" />
            )}
          </div>
        </div>
      )}
    </article>
  );
}
