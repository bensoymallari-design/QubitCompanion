import path from "node:path";
import { DATABASE_PATH, SETTINGS_PATH, THUMBNAILS_DIR, UPLOADS_DIR } from "@/lib/constants";

export function resolveFromRoot(relativePath: string): string {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), relativePath);
}

export function uploadsPath(): string {
  return resolveFromRoot(UPLOADS_DIR);
}

export function thumbnailsPath(): string {
  return resolveFromRoot(THUMBNAILS_DIR);
}

export function databasePath(): string {
  return resolveFromRoot(DATABASE_PATH);
}

export function settingsPath(): string {
  return resolveFromRoot(SETTINGS_PATH);
}

export function ensureInsideStorage(absolutePath: string): void {
  const storageRoot = resolveFromRoot("storage");
  const relative = path.relative(storageRoot, absolutePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes local storage");
  }
}
