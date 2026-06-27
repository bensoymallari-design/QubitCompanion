import { jsonError, jsonOk } from "@/lib/api";
import { saveUpload } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return jsonError(new Error("No files were uploaded"), 400);
    }

    const uploaded = [];
    for (const file of files) {
      uploaded.push(await saveUpload(file));
    }

    return jsonOk({ files: uploaded }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const status = message.includes("unsupported") ? 415 : message.includes("space") || message.includes("enospc") ? 507 : 500;
    return jsonError(error, status);
  }
}
