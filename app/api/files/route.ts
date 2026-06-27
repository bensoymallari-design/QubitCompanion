import { jsonError, jsonOk, parseBoolean, parseNumber } from "@/lib/api";
import { listMedia, storageStats } from "@/lib/storage";
import type { MediaKind, MediaSort } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    const list = await listMedia({
      search: params.get("search") ?? undefined,
      kind: (params.get("kind") as MediaKind | "all" | null) ?? "all",
      favorites: parseBoolean(params.get("favorites")),
      sort: (params.get("sort") as MediaSort | null) ?? "newest",
      page: parseNumber(params.get("page")),
      pageSize: parseNumber(params.get("pageSize"))
    });
    const stats = await storageStats();

    return jsonOk({ ...list, stats });
  } catch (error) {
    return jsonError(error);
  }
}
