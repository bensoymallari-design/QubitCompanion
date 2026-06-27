import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { resolveFromRoot } from "@/lib/paths";
import { getMedia } from "@/lib/storage";

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

    const file = await fs.readFile(resolveFromRoot(media.relativePath));
    return new NextResponse(file, {
      headers: {
        "content-type": media.mimeType,
        "content-disposition": `inline; filename="${media.filename.replace(/"/g, "")}"`,
        "cache-control": "private, max-age=3600"
      }
    });
  } catch (error) {
    return jsonError(error, 404);
  }
}
