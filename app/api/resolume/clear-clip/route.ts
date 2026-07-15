import { jsonError, jsonOk } from "@/lib/api";
import { ResolumeService } from "@/services/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { layer?: number; clip?: number; targetId?: string };

    if (!body.layer || !body.clip) {
      return jsonError(new Error("layer and clip are required"), 400);
    }

    const service = await ResolumeService.forTarget(body.targetId);
    return jsonOk(await service.clearClip({ layer: body.layer, clip: body.clip }));
  } catch (error) {
    return jsonError(error, 503);
  }
}
