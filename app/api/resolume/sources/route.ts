import { jsonError, jsonOk } from "@/lib/api";
import { ResolumeService } from "@/services/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ndiOnly = url.searchParams.get("ndi") === "true";
    const service = await ResolumeService.fromSettings();
    const sources = await service.sources();

    return jsonOk({ sources: ndiOnly ? sources.filter((source) => source.isNdi) : sources });
  } catch (error) {
    return jsonError(error, 503);
  }
}
