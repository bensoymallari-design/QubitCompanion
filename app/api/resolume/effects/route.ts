import { jsonError, jsonOk, parseNumber, targetIdFromRequest } from "@/lib/api";
import { ResolumeService } from "@/services/resolume";
import type { ResolumeControlScope } from "@/types/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const service = await ResolumeService.forTarget(targetIdFromRequest(request));
    return jsonOk({ effects: await service.effects() });
  } catch (error) {
    return jsonError(error, 503);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      scope?: ResolumeControlScope;
      layer?: number;
      clip?: number;
      effect?: string;
      targetId?: string;
    };

    const service = await ResolumeService.forTarget(body.targetId);
    return jsonOk(
      await service.addEffect(
        {
          scope: body.scope ?? "clip",
          layer: parseNumber(String(body.layer ?? "")),
          clip: parseNumber(String(body.clip ?? ""))
        },
        body.effect ?? ""
      )
    );
  } catch (error) {
    return jsonError(error, 503);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      scope?: ResolumeControlScope;
      layer?: number;
      clip?: number;
      effectIndex?: number;
      targetId?: string;
    };

    const service = await ResolumeService.forTarget(body.targetId);
    return jsonOk(
      await service.removeEffect(
        {
          scope: body.scope ?? "clip",
          layer: parseNumber(String(body.layer ?? "")),
          clip: parseNumber(String(body.clip ?? ""))
        },
        Number(body.effectIndex)
      )
    );
  } catch (error) {
    return jsonError(error, 503);
  }
}
