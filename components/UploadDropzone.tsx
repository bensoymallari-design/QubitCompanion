"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";

const ACCEPT = ".png,.jpg,.jpeg,.gif,.mp4,.mov,.webm,image/png,image/jpeg,image/gif,video/mp4,video/quicktime,video/webm";

export function UploadDropzone({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const { notify } = useToast();

  async function upload(files: FileList | File[]) {
    const selected = Array.from(files);
    if (selected.length === 0) {
      return;
    }

    const form = new FormData();
    selected.forEach((file) => form.append("files", file));
    setProgress(8);

    try {
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", "/api/upload");
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.max(8, Math.round((event.loaded / event.total) * 100)));
          }
        };
        request.onload = () => {
          if (request.status >= 200 && request.status < 300) {
            resolve();
          } else {
            reject(new Error(extractError(request.responseText) || "Upload failed"));
          }
        };
        request.onerror = () => reject(new Error("Upload failed. Check disk space and supported formats."));
        request.send(form);
      });
      notify(`Uploaded ${selected.length} file${selected.length === 1 ? "" : "s"}`, "success");
      onUploaded();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Upload failed", "error");
    } finally {
      setProgress(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        upload(event.dataTransfer.files);
      }}
      className={`rounded-[2rem] border-2 border-dashed p-6 text-center transition ${
        dragging ? "border-sky-300 bg-sky-300/10" : "border-white/20 bg-white/5"
      }`}
    >
      <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={(event) => event.target.files && upload(event.target.files)} />
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-300">Drag and drop</p>
      <h2 className="mt-3 text-3xl font-black">Upload images, GIFs, and videos</h2>
      <p className="mt-2 text-slate-300">PNG, JPG, JPEG, GIF, MP4, MOV, and WebM are stored locally.</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-6 min-h-16 rounded-2xl bg-sky-300 px-8 text-xl font-black text-slate-950"
      >
        Choose Files
      </button>
      {progress !== null && (
        <div className="mt-6">
          <div className="h-4 overflow-hidden rounded-full bg-black/30">
            <div className="h-full rounded-full bg-sky-300 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 text-sm font-bold text-slate-300">{progress}% uploaded</div>
        </div>
      )}
    </div>
  );
}

function extractError(raw: string): string | null {
  try {
    return (JSON.parse(raw) as { error?: string }).error ?? null;
  } catch {
    return null;
  }
}
