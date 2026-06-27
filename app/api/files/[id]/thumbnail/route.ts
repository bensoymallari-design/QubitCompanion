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

    if (media.kind === "image" || media.kind === "gif") {
      const image = await fs.readFile(resolveFromRoot(media.relativePath));
      return new NextResponse(image, {
        headers: {
          "content-type": media.mimeType,
          "cache-control": "public, max-age=31536000, immutable"
        }
      });
    }

    const thumbnail = await fs.readFile(resolveFromRoot(media.thumbnailPath));
    return new NextResponse(thumbnail, {
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "public, max-age=31536000, immutable"
      }
    });
  } catch (error) {
    return jsonError(error, 404);
  }
}
