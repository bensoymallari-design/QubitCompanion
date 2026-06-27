import { jsonError, jsonOk } from "@/lib/api";
import { replaceUpload } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return jsonError(new Error("Replacement file is required"), 400);
    }

    const media = await replaceUpload(id, file);
    return jsonOk({ file: media });
  } catch (error) {
    return jsonError(error, 400);
  }
}
