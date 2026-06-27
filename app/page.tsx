import Link from "next/link";
import { DashboardRefresh } from "@/components/DashboardRefresh";
import { QuickUploadButton } from "@/components/QuickUploadButton";
import { ResolumeService } from "@/services/resolume";
import { ensureStorage, storageStats } from "@/lib/storage";
import { formatBytes, formatDate } from "@/utils/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await ensureStorage();
  const [stats, status] = await Promise.all([storageStats(), ResolumeService.fromSettings().then((service) => service.status())]);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-sky-300">Local only</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Media control for Resolume Arena</h1>
            <p className="mt-4 max-w-3xl text-lg text-slate-300">
              Upload media, manage the local library, and send clips to Resolume from this PC or another device on the same LAN.
            </p>
          </div>
          <QuickUploadButton />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <DashboardRefresh initialStatus={status} />
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-400">Total Uploaded Files</p>
          <div className="mt-5 text-6xl font-black">{stats.totalFiles}</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-400">Storage Used</p>
          <div className="mt-5 text-6xl font-black">{formatBytes(stats.storageUsed)}</div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-400">Recent Uploads</p>
            <h2 className="mt-2 text-2xl font-black">Latest media</h2>
          </div>
          <Link href="/media" className="rounded-2xl bg-white/10 px-5 py-4 font-bold hover:bg-white/20">
            View all
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stats.recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 p-8 text-slate-400">No uploads yet. Use Quick Upload to add media.</div>
          ) : (
            stats.recent.map((file) => (
              <Link key={file.id} href="/media" className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/10">
                <img src={`/api/files/${file.id}/thumbnail`} alt="" loading="lazy" className="aspect-video w-full rounded-xl object-cover" />
                <div className="mt-3 truncate text-lg font-bold">{file.filename}</div>
                <div className="mt-1 text-sm text-slate-400">
                  {formatBytes(file.size)} - {formatDate(file.createdAt)}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
