import { MediaLibrary } from "@/components/MediaLibrary";
import { NdiSourcePanel } from "@/components/NdiSourcePanel";

export default function MediaPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.35em] text-sky-300">Media Browser</p>
        <h1 className="mt-3 text-4xl font-black md:text-5xl">Upload and manage files</h1>
      </div>
      <NdiSourcePanel />
      <MediaLibrary />
    </div>
  );
}
