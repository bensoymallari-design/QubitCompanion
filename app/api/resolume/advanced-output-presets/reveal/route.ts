import { jsonError, jsonOk } from "@/lib/api";
import { revealAdvancedOutputPreset } from "@/lib/resolume-presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { filePath?: string };

    if (!body.filePath) {
      return jsonError(new Error("Preset file path is required"), 400);
    }

    return jsonOk({ message: await revealAdvancedOutputPreset(body.filePath) });
  } catch (error) {
    return jsonError(error, 400);
  }
}
