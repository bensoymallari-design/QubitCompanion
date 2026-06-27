import { Readable } from "node:stream";
import { jsonError, jsonOk } from "@/lib/api";
import { saveUploadStream } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!request.body) {
      return jsonError(new Error("Upload body is empty"), 400);
    }

    const filename = decodeURIComponent(request.headers.get("x-file-name") ?? "");
    const mimeType = request.headers.get("content-type") ?? undefined;
    const size = Number(request.headers.get("content-length") ?? "0");

    if (!filename) {
      return jsonError(new Error("Missing upload filename"), 400);
    }

    const file = await saveUploadStream({
      filename,
      mimeType,
      size,
      stream: Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0])
    });

    return jsonOk({ files: [file] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const status = message.includes("unsupported") ? 415 : message.includes("too large") ? 413 : message.includes("space") || message.includes("enospc") ? 507 : 500;
    return jsonError(error, status);
  }
}
