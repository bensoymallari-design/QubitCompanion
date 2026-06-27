import { jsonError, jsonOk } from "@/lib/api";
import { readSettings, writeSettings } from "@/lib/storage";
import type { AppSettings } from "@/types/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk({ settings: await readSettings() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const settings = (await request.json()) as AppSettings;
    return jsonOk({ settings: await writeSettings(settings) });
  } catch (error) {
    return jsonError(error, 400);
  }
}
