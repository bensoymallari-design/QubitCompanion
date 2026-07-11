import { jsonError, jsonOk } from "@/lib/api";
import { deleteNdiPreset, readNdiPresets, saveNdiPreset } from "@/lib/storage";
import type { NdiPreset } from "@/types/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk({ presets: await readNdiPresets() });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Omit<NdiPreset, "id" | "createdAt">;

    if (!body.name?.trim() || !body.source?.name || !body.layer || !body.clip) {
      return jsonError(new Error("Preset name, source, layer, and clip are required"), 400);
    }

    const preset = await saveNdiPreset({
      ...body,
      name: body.name.trim(),
      transform: body.transform ?? {}
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

    await deleteNdiPreset(body.id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error, 400);
  }
}
