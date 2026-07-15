import { jsonError, jsonOk } from "@/lib/api";
import { ResolumeService } from "@/services/resolume";
import type { ResolumeLoadRequest } from "@/types/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResolumeLoadRequest & { targetId?: string };

    if (!body.fileId || !body.layer || !body.clip) {
      return jsonError(new Error("fileId, layer, and clip are required"), 400);
    }

    const service = await ResolumeService.forTarget(body.targetId);
    return jsonOk(await service.loadMedia(body));
  } catch (error) {
    return jsonError(error, 503);
  }
}
