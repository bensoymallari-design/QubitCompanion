import { jsonError, jsonOk } from "@/lib/api";
import { ResolumeService } from "@/services/resolume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const service = await ResolumeService.fromSettings();
    return jsonOk({ status: await service.status() });
  } catch (error) {
    return jsonError(error);
  }
}
