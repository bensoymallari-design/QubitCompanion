import { jsonError, jsonOk } from "@/lib/api";
import { ResolumeService } from "@/services/resolume";
import type { ResolumeClipTarget } from "@/types/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResolumeClipTarget & { targetId?: string };
    const service = await ResolumeService.forTarget(body.targetId);
    return jsonOk(await service.stopClip(body));
  } catch (error) {
    return jsonError(error, 503);
  }
}
