"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center text-center">
      <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-8">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-rose-200">Something went wrong</p>
        <h1 className="mt-4 text-3xl font-black">{error.message}</h1>
        <button
          type="button"
          onClick={reset}
          className="mt-8 min-h-14 rounded-2xl bg-rose-300 px-8 text-lg font-black text-slate-950"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
