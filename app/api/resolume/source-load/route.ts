import { jsonError, jsonOk } from "@/lib/api";
import { ResolumeService } from "@/services/resolume";
import type { ResolumeSourceLoadRequest } from "@/types/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResolumeSourceLoadRequest;

    if (!body.source?.name || !body.layer || !body.clip) {
      return jsonError(new Error("source, layer, and clip are required"), 400);
    }

    const service = await ResolumeService.fromSettings();
    return jsonOk(await service.loadSource(body));
  } catch (error) {
    return jsonError(error, 503);
  }
}
