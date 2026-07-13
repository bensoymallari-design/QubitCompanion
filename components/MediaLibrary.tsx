"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { MediaCard } from "@/components/MediaCard";
import { UploadDropzone } from "@/components/UploadDropzone";
import { useToast } from "@/components/ToastProvider";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { MediaFile, MediaKind, MediaSort } from "@/types/media";

interface MediaResponse {
  files: MediaFile[];
  total: number;
  page: number;
  pageSize: number;
  stats?: {
    totalFiles: number;
    storageUsed: number;
  };
}

export function MediaLibrary() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<MediaKind | "all">("all");
  const [sort, setSort] = useState<MediaSort>("newest");
  const [favorites, setFavorites] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { notify } = useToast();

  const pageSize = 24;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        kind,
        sort,
        page: String(page),
        pageSize: String(pageSize),
        favorites: String(favorites)
      });
      const response = await fetch(`/api/files?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as MediaResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load files");
      }
      setFiles(data.files);
      setTotal(data.total);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to load files", "error");
    } finally {
      setLoading(false);
    }
  }, [favorites, kind, notify, page, search, sort]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useKeyboardShortcuts(
    useMemo(
      () => ({
        u: () => document.getElementById("quick-upload-zone")?.scrollIntoView({ behavior: "smooth" }),
        r: () => setRefreshKey((value) => value + 1),
        f: () => setFavorites((value) => !value)
      }),
      []
    )
  );

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div id="quick-upload-zone">
        <CollapsiblePanel
          eyebrow="Upload"
          title="Upload media files"
          description="Add images, GIFs, and videos into the configured server folder."
          defaultOpen={false}
        >
          <UploadDropzone
            onUploaded={() => {
              setPage(1);
              setRefreshKey((value) => value + 1);
            }}
          />
        </CollapsiblePanel>
      </div>

      <CollapsiblePanel
        eyebrow="Media Library"
        title="Browse uploaded media"
        description={`${total} file${total === 1 ? "" : "s"} available. Search, filter, send, rename, duplicate, or delete media.`}
        defaultOpen
      >
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search media..."
              className="min-h-14 rounded-2xl border border-white/10 bg-slate-950 px-5 text-lg outline-none focus:border-sky-300"
            />
            <select value={kind} onChange={(event) => setKind(event.target.value as MediaKind | "all")} className="min-h-14 rounded-2xl bg-slate-950 px-5 font-bold">
              <option value="all">All files</option>
              <option value="image">Images</option>
              <option value="gif">GIFs</option>
              <option value="video">Videos</option>
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value as MediaSort)} className="min-h-14 rounded-2xl bg-slate-950 px-5 font-bold">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
            <button
              type="button"
              onClick={() => setFavorites((value) => !value)}
              className={`min-h-14 rounded-2xl px-5 font-black ${favorites ? "bg-amber-300 text-slate-950" : "bg-white/10"}`}
            >
              Favorites
            </button>
            <button
              type="button"
              onClick={async () => {
                const response = await fetch("/api/system/open-folder", { method: "POST" });
                notify(response.ok ? "Upload folder opened" : "Could not open upload folder", response.ok ? "success" : "error");
              }}
              className="min-h-14 rounded-2xl bg-white/10 px-5 font-black"
            >
              Open Folder
            </button>
          </div>
          <div className="mt-3 text-sm text-slate-400">Shortcuts: U upload, R refresh, F favorites. Drag media cards onto Resolume clip targets by choosing Send.</div>
        </section>

        <div className="mt-6">
          {loading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-96 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/20 p-12 text-center text-xl text-slate-300">No media found.</div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {files.map((file) => (
                <MediaCard key={file.id} file={file} onChanged={() => setRefreshKey((value) => value + 1)} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 md:flex-row">
          <div className="text-slate-300">
            Showing page {page} of {pages} ({total} files)
          </div>
          <div className="flex gap-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-h-12 rounded-2xl bg-white/10 px-5 font-black disabled:opacity-40">
              Previous
            </button>
            <button type="button" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="min-h-12 rounded-2xl bg-white/10 px-5 font-black disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      </CollapsiblePanel>
    </div>
  );
}
