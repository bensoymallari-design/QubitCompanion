import { jsonError, jsonOk } from "@/lib/api";
import { deleteMedia, getMedia, renameMedia, setFavorite } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const media = await getMedia(id);

    if (!media) {
      return jsonError(new Error("Media file not found"), 404);
    }

    return jsonOk({ file: media });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { filename?: string; favorite?: boolean };
    let media = body.filename ? await renameMedia(id, body.filename) : await getMedia(id);

    if (!media) {
      return jsonError(new Error("Media file not found"), 404);
    }

    if (typeof body.favorite === "boolean") {
      media = await setFavorite(id, body.favorite);
    }

    return jsonOk({ file: media });
  } catch (error) {
    return jsonError(error, 400);
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    await deleteMedia(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error, 404);
  }
}
