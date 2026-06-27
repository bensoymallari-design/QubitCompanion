import { jsonError, jsonOk, parseNumber } from "@/lib/api";
import { ResolumeService } from "@/services/resolume";
import type { ResolumeControlScope, ResolumeParameterValue } from "@/types/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scope = (url.searchParams.get("scope") ?? "clip") as ResolumeControlScope;
    const service = await ResolumeService.fromSettings();
    const parameters = await service.parameters({
      scope,
      layer: parseNumber(url.searchParams.get("layer")),
      clip: parseNumber(url.searchParams.get("clip"))
    });

    return jsonOk({ parameters });
  } catch (error) {
    return jsonError(error, 503);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; value?: ResolumeParameterValue };

    if (!body.id) {
      return jsonError(new Error("Parameter id is required"), 400);
    }

    const service = await ResolumeService.fromSettings();
    return jsonOk(await service.updateParameter(body.id, body.value ?? null));
  } catch (error) {
    return jsonError(error, 503);
  }
}
