"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { formatBytes } from "@/utils/format";

const ACCEPT = ".png,.jpg,.jpeg,.gif,.mp4,.mov,.webm,image/png,image/jpeg,image/gif,video/mp4,video/quicktime,video/webm";

export function UploadDropzone({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [currentUpload, setCurrentUpload] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ tone: "info" | "success" | "error"; message: string } | null>(null);
  const { notify } = useToast();

  async function upload(files: FileList | File[]) {
    const selected = Array.from(files);
    if (selected.length === 0) {
      return;
    }

    setProgress(8);
    setUploadStatus({ tone: "info", message: `Preparing ${selected.length} file${selected.length === 1 ? "" : "s"} for upload to the server PC...` });

    try {
      let completedBytes = 0;
      const totalBytes = selected.reduce((total, file) => total + file.size, 0);

      for (const file of selected) {
        setCurrentUpload(`Uploading ${file.name} (${formatBytes(file.size)}) to the server PC...`);
        setUploadStatus({ tone: "info", message: `Uploading ${file.name}. Please keep this page open until it is saved.` });
        await uploadSingleFile(file, (loaded) => {
          const percent = totalBytes > 0 ? Math.round(((completedBytes + loaded) / totalBytes) * 100) : 100;
          setProgress(Math.min(100, Math.max(8, percent)));
        });
        completedBytes += file.size;
      }

      const message = `Saved ${selected.length} file${selected.length === 1 ? "" : "s"} to the server PC.`;
      setProgress(100);
      setUploadStatus({ tone: "success", message });
      notify(message, "success");
      onUploaded();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setUploadStatus({ tone: "error", message });
      notify(message, "error");
    } finally {
      setCurrentUpload(null);
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
      <p className="mt-2 text-slate-300">PNG, JPG, JPEG, GIF, MP4, MOV, and WebM are saved to the configured folder on the server PC.</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-6 min-h-16 rounded-2xl bg-sky-300 px-8 text-xl font-black text-slate-950"
      >
        Choose Files
      </button>
      {(progress !== null || uploadStatus) && (
        <div
          className={`mt-6 rounded-3xl border p-4 ${
            uploadStatus?.tone === "error"
              ? "border-rose-400/40 bg-rose-500/10"
              : uploadStatus?.tone === "success"
                ? "border-emerald-400/40 bg-emerald-500/10"
                : "border-sky-400/30 bg-sky-500/10"
          }`}
        >
          <div className="h-4 overflow-hidden rounded-full bg-black/30">
            <div
              className={`h-full rounded-full transition-all ${uploadStatus?.tone === "error" ? "bg-rose-300" : uploadStatus?.tone === "success" ? "bg-emerald-300" : "bg-sky-300"}`}
              style={{ width: `${progress ?? 0}%` }}
            />
          </div>
          {progress !== null && <div className="mt-2 text-sm font-bold text-slate-300">{progress}% uploaded</div>}
          {currentUpload && <div className="mt-1 text-sm text-slate-400">{currentUpload}</div>}
          {uploadStatus && <div className="mt-2 text-sm font-semibold text-slate-200">{uploadStatus.message}</div>}
          {uploadStatus?.tone !== "info" && (
            <button type="button" onClick={() => { setProgress(null); setUploadStatus(null); }} className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold">
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function uploadSingleFile(file: File, onProgress: (loaded: number) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/upload/raw");
    request.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    request.setRequestHeader("x-file-size", String(file.size));
    if (file.type) {
      request.setRequestHeader("content-type", file.type);
    }
    request.timeout = 0;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(new Error(extractError(request.responseText) || `Upload failed with status ${request.status}`));
      }
    };
    request.onerror = () => reject(new Error("Upload failed. Check Wi-Fi stability, disk space, and supported formats."));
    request.ontimeout = () => reject(new Error("Upload timed out. Try a smaller file or a stronger local network connection."));
    request.send(file);
  });
}

function extractError(raw: string): string | null {
  try {
    return (JSON.parse(raw) as { error?: string }).error ?? null;
  } catch {
    return null;
  }
}
