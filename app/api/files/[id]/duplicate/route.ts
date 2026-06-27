import { jsonError, jsonOk } from "@/lib/api";
import { duplicateMedia } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

export async function POST(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const file = await duplicateMedia(id);
    return jsonOk({ file }, { status: 201 });
  } catch (error) {
    return jsonError(error, 404);
  }
}
