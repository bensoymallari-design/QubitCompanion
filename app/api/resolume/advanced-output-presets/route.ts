import { jsonError, jsonOk } from "@/lib/api";
import { listAdvancedOutputPresets } from "@/lib/resolume-presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk({ presets: await listAdvancedOutputPresets() });
  } catch (error) {
    return jsonError(error, 500);
  }
}
