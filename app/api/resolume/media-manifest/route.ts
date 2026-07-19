import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { jsonError, jsonOk } from "@/lib/api";
import { readDatabase, resolveMediaPath } from "@/lib/storage";
import type { MediaFile } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AgentManifestFile {
  path: string;
  url: string;
  size: number;
  sha256?: string;
  updatedAt: string;
  mimeType: string;
}

export async function GET(request: Request) {
  try {
    const token = process.env.COMPANION_AGENT_TOKEN;
    if (token) {
      const authorization = request.headers.get("authorization");
      if (authorization !== `Bearer ${token}`) {
        return jsonError(new Error("Unauthorized"), 401);
      }
    }

    const url = new URL(request.url);
    const includeHashes = url.searchParams.get("sha256") === "true";
    const origin = url.origin;
    const database = await readDatabase();
    const files: AgentManifestFile[] = [];

    for (const media of database.files) {
      const entry: AgentManifestFile = {
        path: agentPath(media),
        url: `${origin}/api/files/${media.id}/raw`,
        size: media.size,
        updatedAt: media.updatedAt,
        mimeType: media.mimeType
      };

      if (includeHashes) {
        entry.sha256 = await sha256File(resolveMediaPath(media.relativePath));
      }

      files.push(entry);
    }

    return jsonOk({ generatedAt: new Date().toISOString(), files });
  } catch (error) {
    return jsonError(error);
  }
}

function agentPath(media: MediaFile): string {
  const folder = media.kind === "video" ? "videos" : media.kind === "gif" ? "gifs" : "images";
  return `${folder}/${media.id}-${media.filename}`;
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
