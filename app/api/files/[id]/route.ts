import { jsonError, jsonOk } from "@/lib/api";
import { deleteMedia, getMedia, renameMedia, setFavorite } from "@/lib/storage";
import { ResolumeService } from "@/services/resolume";

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
    try {
      const service = await ResolumeService.fromSettings();
      await service.clearMediaReferences(id);
      await new Promise((resolve) => setTimeout(resolve, 750));
    } catch {
      // Deleting local media should still work when Resolume is offline or does not expose clear endpoints.
    }

    await deleteMedia(id);
    return jsonOk({ ok: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "EBUSY" || code === "EPERM") {
      return jsonError(
        new Error("Windows says this file is still locked. Stop/clear the clip in Resolume or close Resolume, then delete again."),
        423
      );
    }

    return jsonError(error, 404);
  }
}
