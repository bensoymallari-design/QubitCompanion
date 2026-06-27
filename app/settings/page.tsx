import { SettingsForm } from "@/components/SettingsForm";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.35em] text-sky-300">Settings</p>
        <h1 className="mt-3 text-4xl font-black md:text-5xl">Local configuration</h1>
        <p className="mt-3 max-w-3xl text-slate-300">Settings are saved to storage/settings.json and are never sent to any cloud service.</p>
      </div>
      <SettingsForm />
    </div>
  );
}
