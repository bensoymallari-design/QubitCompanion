import { jsonError, jsonOk } from "@/lib/api";
import { ResolumeService } from "@/services/resolume";
import type { ResolumeParameterValue } from "@/types/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const service = await ResolumeService.fromSettings();
    return jsonOk({ parameters: await service.outputParameters() });
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
