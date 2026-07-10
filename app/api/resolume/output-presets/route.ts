import { jsonError, jsonOk } from "@/lib/api";
import { deleteOutputPreset, readOutputPresets, saveOutputPreset } from "@/lib/storage";
import type { ResolumeOutputPreset } from "@/types/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk({ presets: await readOutputPresets() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Pick<ResolumeOutputPreset, "name" | "parameters">;

    if (!body.name?.trim() || !Array.isArray(body.parameters)) {
      return jsonError(new Error("Preset name and parameters are required"), 400);
    }

    const preset = await saveOutputPreset({
      name: body.name.trim(),
      parameters: body.parameters
    });

    return jsonOk({ preset }, { status: 201 });
  } catch (error) {
    return jsonError(error, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };

    if (!body.id) {
      return jsonError(new Error("Preset id is required"), 400);
    }

    await deleteOutputPreset(body.id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error, 400);
  }
}
