import { jsonError, jsonOk, targetIdFromRequest } from "@/lib/api";
import { ResolumeService } from "@/services/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const service = await ResolumeService.forTarget(targetIdFromRequest(request));
    return jsonOk({ composition: await service.composition() });
  } catch (error) {
    return jsonError(error, 503);
  }
}
