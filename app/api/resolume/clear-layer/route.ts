import { jsonError, jsonOk } from "@/lib/api";
import { ResolumeService } from "@/services/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { layer?: number };

    if (!body.layer) {
      return jsonError(new Error("layer is required"), 400);
    }

    const service = await ResolumeService.fromSettings();
    return jsonOk(await service.clearLayer(body.layer));
  } catch (error) {
    return jsonError(error, 503);
  }
}
