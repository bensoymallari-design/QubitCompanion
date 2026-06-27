import { jsonError, jsonOk } from "@/lib/api";
import { ResolumeService } from "@/services/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const service = await ResolumeService.fromSettings();
    return jsonOk({ layers: await service.layers() });
  } catch (error) {
    return jsonError(error, 503);
  }
}
