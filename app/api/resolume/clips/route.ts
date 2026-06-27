import { jsonError, jsonOk, parseNumber } from "@/lib/api";
import { ResolumeService } from "@/services/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const service = await ResolumeService.fromSettings();
    return jsonOk({ clips: await service.clips(parseNumber(url.searchParams.get("layer"))) });
  } catch (error) {
    return jsonError(error, 503);
  }
}
