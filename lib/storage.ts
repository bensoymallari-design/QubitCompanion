import { constants, createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  DATABASE_PATH,
  MEDIA_KIND_BY_EXTENSION,
  MAX_UPLOAD_BYTES,
  SETTINGS_PATH,
  SUPPORTED_EXTENSIONS,
  SUPPORTED_MIME_TYPES,
  THUMBNAILS_DIR,
  UPLOADS_DIR
} from "@/lib/constants";
import { databasePath, resolveFromRoot, settingsPath, thumbnailsPath, uploadsPath } from "@/lib/paths";
import type { MediaDatabase, MediaExtension, MediaFile, MediaKind, MediaListQuery } from "@/types/media";
import { DEFAULT_SETTINGS, type AppSettings } from "@/types/settings";
import { safeFilename } from "@/utils/format";

const EMPTY_DATABASE: MediaDatabase = { files: [] };

export async function ensureStorage(): Promise<void> {
  await fs.mkdir(uploadsPath(), { recursive: true });
  await fs.mkdir(thumbnailsPath(), { recursive: true });
  await ensureJsonFile(databasePath(), EMPTY_DATABASE);
  await ensureJsonFile(settingsPath(), DEFAULT_SETTINGS);
}

async function ensureJsonFile<T>(filePath: string, fallback: T): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), "utf8");
  }
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  await ensureStorage();

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filePath: string, value: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(temporary, filePath);
}

export async function readDatabase(): Promise<MediaDatabase> {
  return readJson<MediaDatabase>(databasePath(), EMPTY_DATABASE);
}

export async function writeDatabase(database: MediaDatabase): Promise<void> {
  await writeJson(databasePath(), database);
}

export async function readSettings(): Promise<AppSettings> {
  const settings = await readJson<AppSettings>(settingsPath(), DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function writeSettings(settings: AppSettings): Promise<AppSettings> {
  const normalized: AppSettings = {
    resolumeIp: settings.resolumeIp?.trim() || DEFAULT_SETTINGS.resolumeIp,
    resolumePort: Number(settings.resolumePort) || DEFAULT_SETTINGS.resolumePort,
    uploadFolder: normalizeUploadFolder(settings.uploadFolder),
    autoRefresh: Boolean(settings.autoRefresh),
    darkMode: Boolean(settings.darkMode),
    allowSystemControls: Boolean(settings.allowSystemControls)
  };

  await ensureWritableUploadFolder(normalized.uploadFolder);
  await writeJson(settingsPath(), normalized);
  return normalized;
}

export function extensionForName(filename: string): MediaExtension | null {
  const extension = path.extname(filename).replace(".", "").toLowerCase() as MediaExtension;
  return SUPPORTED_EXTENSIONS.includes(extension) ? extension : null;
}

export function kindForExtension(extension: MediaExtension): MediaKind {
  return MEDIA_KIND_BY_EXTENSION[extension];
}

export function assertSupportedFile(file: File): MediaExtension {
  return assertSupportedUpload(file.name, file.type, file.size);
}

export function assertSupportedUpload(filename: string, mimeType: string | undefined, size: number): MediaExtension {
  const extension = extensionForName(filename);
  const normalizedMimeType = mimeType?.split(";")[0]?.trim().toLowerCase();

  if (!extension) {
    throw new Error(`Unsupported file type. Supported formats: ${SUPPORTED_EXTENSIONS.join(", ")}`);
  }

  if (normalizedMimeType && normalizedMimeType !== "application/octet-stream" && !SUPPORTED_MIME_TYPES.has(normalizedMimeType)) {
    throw new Error(`Unsupported MIME type: ${mimeType}`);
  }

  if (size > MAX_UPLOAD_BYTES) {
    throw new Error(`File is too large. Max upload size is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024 / 1024)} GB`);
  }

  return extension;
}

export async function saveUpload(file: File): Promise<MediaFile> {
  await ensureStorage();
  const extension = assertSupportedFile(file);
  const id = randomUUID();
  const now = new Date().toISOString();
  const cleanName = safeFilename(file.name);
  const filename = `${id}-${cleanName}`;
  const uploadFolder = await configuredUploadFolder();
  const relativePath = joinUploadPath(uploadFolder, filename);
  const absolutePath = resolveMediaPath(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  const thumbnailPath = `${THUMBNAILS_DIR}/${id}.svg`;
  await writeThumbnailSvg(resolveFromRoot(thumbnailPath), cleanName, kindForExtension(extension));

  const media: MediaFile = {
    id,
    filename: cleanName,
    originalName: file.name,
    extension,
    mimeType: file.type || mimeForExtension(extension),
    kind: kindForExtension(extension),
    size: file.size,
    relativePath,
    thumbnailPath,
    favorite: false,
    createdAt: now,
    updatedAt: now
  };

  const database = await readDatabase();
  database.files.unshift(media);
  await writeDatabase(database);

  return media;
}

export async function saveUploadStream(input: {
  filename: string;
  mimeType?: string;
  size: number;
  stream: Readable;
}): Promise<MediaFile> {
  await ensureStorage();
  const extension = assertSupportedUpload(input.filename, input.mimeType, input.size);
  const id = randomUUID();
  const now = new Date().toISOString();
  const cleanName = safeFilename(input.filename);
  const filename = `${id}-${cleanName}`;
  const uploadFolder = await configuredUploadFolder();
  const relativePath = joinUploadPath(uploadFolder, filename);
  const absolutePath = resolveMediaPath(relativePath);
  const temporaryPath = `${absolutePath}.${process.pid}.${Date.now()}.uploading`;
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });

  let written = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      written += chunk.length;
      if (written > MAX_UPLOAD_BYTES) {
        callback(new Error(`File is too large. Max upload size is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024 / 1024)} GB`));
        return;
      }
      callback(null, chunk);
    }
  });

  try {
    await pipeline(input.stream, counter, createWriteStream(temporaryPath));
    await fs.rename(temporaryPath, absolutePath);
  } catch (error) {
    await removeIfExists(temporaryPath);
    throw error;
  }

  const thumbnailPath = `${THUMBNAILS_DIR}/${id}.svg`;
  await writeThumbnailSvg(resolveFromRoot(thumbnailPath), cleanName, kindForExtension(extension));

  const media: MediaFile = {
    id,
    filename: cleanName,
    originalName: input.filename,
    extension,
    mimeType: input.mimeType || mimeForExtension(extension),
    kind: kindForExtension(extension),
    size: written || input.size,
    relativePath,
    thumbnailPath,
    favorite: false,
    createdAt: now,
    updatedAt: now
  };

  const database = await readDatabase();
  database.files.unshift(media);
  await writeDatabase(database);

  return media;
}

export async function replaceUpload(id: string, file: File): Promise<MediaFile> {
  await ensureStorage();
  const extension = assertSupportedFile(file);
  const database = await readDatabase();
  const current = findMediaOrThrow(database, id);
  const cleanName = safeFilename(file.name);
  const filename = `${id}-${cleanName}`;
  const uploadFolder = await configuredUploadFolder();
  const relativePath = joinUploadPath(uploadFolder, filename);
  const absolutePath = resolveMediaPath(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });

  const previousPath = resolveMediaPath(current.relativePath);
  await fs.writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));
  if (previousPath !== absolutePath) {
    await removeIfExists(previousPath);
  }

  await writeThumbnailSvg(resolveFromRoot(current.thumbnailPath), cleanName, kindForExtension(extension));

  const updated: MediaFile = {
    ...current,
    filename: cleanName,
    originalName: file.name,
    extension,
    mimeType: file.type || mimeForExtension(extension),
    kind: kindForExtension(extension),
    size: file.size,
    relativePath,
    updatedAt: new Date().toISOString()
  };

  await updateMedia(database, updated);
  return updated;
}

export async function listMedia(query: MediaListQuery): Promise<{ files: MediaFile[]; total: number; page: number; pageSize: number }> {
  const database = await readDatabase();
  const search = query.search?.trim().toLowerCase();
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(96, Math.max(6, Number(query.pageSize) || 24));

  let files = database.files.slice();

  if (search) {
    files = files.filter((file) => file.filename.toLowerCase().includes(search) || file.originalName.toLowerCase().includes(search));
  }

  if (query.kind && query.kind !== "all") {
    files = files.filter((file) => file.kind === query.kind);
  }

  if (query.favorites) {
    files = files.filter((file) => file.favorite);
  }

  files.sort((a, b) => {
    switch (query.sort) {
      case "oldest":
        return Date.parse(a.createdAt) - Date.parse(b.createdAt);
      case "name":
        return a.filename.localeCompare(b.filename);
      case "size":
        return b.size - a.size;
      case "newest":
      default:
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    }
  });

  const total = files.length;
  const start = (page - 1) * pageSize;
  return { files: files.slice(start, start + pageSize), total, page, pageSize };
}

export async function getMedia(id: string): Promise<MediaFile | null> {
  const database = await readDatabase();
  return database.files.find((file) => file.id === id) ?? null;
}

export async function renameMedia(id: string, filename: string): Promise<MediaFile> {
  const database = await readDatabase();
  const media = findMediaOrThrow(database, id);
  const cleanName = safeFilename(filename);
  const updated = { ...media, filename: cleanName, updatedAt: new Date().toISOString() };
  await updateMedia(database, updated);
  return updated;
}

export async function setFavorite(id: string, favorite: boolean): Promise<MediaFile> {
  const database = await readDatabase();
  const media = findMediaOrThrow(database, id);
  const updated = { ...media, favorite, updatedAt: new Date().toISOString() };
  await updateMedia(database, updated);
  return updated;
}

export async function duplicateMedia(id: string): Promise<MediaFile> {
  await ensureStorage();
  const database = await readDatabase();
  const media = findMediaOrThrow(database, id);
  const nextId = randomUUID();
  const now = new Date().toISOString();
  const copiedName = safeFilename(`copy-of-${media.filename}`);
  const uploadRelativePath = joinUploadPath(await configuredUploadFolder(), `${nextId}-${copiedName}`);
  const thumbRelativePath = `${THUMBNAILS_DIR}/${nextId}.svg`;
  await fs.mkdir(path.dirname(resolveMediaPath(uploadRelativePath)), { recursive: true });

  await fs.copyFile(resolveMediaPath(media.relativePath), resolveMediaPath(uploadRelativePath));
  await fs.copyFile(resolveFromRoot(media.thumbnailPath), resolveFromRoot(thumbRelativePath));

  const duplicate: MediaFile = {
    ...media,
    id: nextId,
    filename: copiedName,
    originalName: media.originalName,
    relativePath: uploadRelativePath,
    thumbnailPath: thumbRelativePath,
    favorite: false,
    createdAt: now,
    updatedAt: now
  };

  database.files.unshift(duplicate);
  await writeDatabase(database);
  return duplicate;
}

export async function deleteMedia(id: string): Promise<void> {
  const database = await readDatabase();
  const media = findMediaOrThrow(database, id);
  await removeIfExists(resolveMediaPath(media.relativePath));
  await removeIfExists(resolveFromRoot(media.thumbnailPath));
  database.files = database.files.filter((file) => file.id !== id);
  await writeDatabase(database);
}

export async function storageStats(): Promise<{ totalFiles: number; storageUsed: number; recent: MediaFile[] }> {
  const database = await readDatabase();
  const storageUsed = database.files.reduce((total, file) => total + file.size, 0);
  const recent = database.files
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 6);

  return { totalFiles: database.files.length, storageUsed, recent };
}

function findMediaOrThrow(database: MediaDatabase, id: string): MediaFile {
  const media = database.files.find((file) => file.id === id);

  if (!media) {
    throw new Error("Media file not found");
  }

  return media;
}

async function updateMedia(database: MediaDatabase, updated: MediaFile): Promise<void> {
  database.files = database.files.map((file) => (file.id === updated.id ? updated : file));
  await writeDatabase(database);
}

async function removeIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function configuredUploadFolder(): Promise<string> {
  const settings = await readSettings();
  return normalizeUploadFolder(settings.uploadFolder);
}

export function resolveMediaPath(storedPath: string): string {
  if (isAbsoluteServerPath(storedPath)) {
    return storedPath;
  }

  return resolveFromRoot(storedPath);
}

export async function configuredUploadFolderPath(): Promise<string> {
  return resolveMediaPath(await configuredUploadFolder());
}

function normalizeUploadFolder(input: string | undefined): string {
  const trimmed = input?.trim() || DEFAULT_SETTINGS.uploadFolder;
  const normalized = trimmed.replace(/\\/g, "/").replace(/\/+$/, "");

  if (!normalized || normalized === ".") {
    return UPLOADS_DIR;
  }

  return normalized;
}

function joinUploadPath(folder: string, filename: string): string {
  return `${folder.replace(/[\\/]+$/, "")}/${filename}`;
}

function isAbsoluteServerPath(value: string): boolean {
  return path.isAbsolute(value) || /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("//");
}

async function ensureWritableUploadFolder(folder: string): Promise<void> {
  const absoluteFolder = resolveMediaPath(folder);
  await fs.mkdir(absoluteFolder, { recursive: true });
  await fs.access(absoluteFolder, constants.W_OK);
}

async function writeThumbnailSvg(filePath: string, filename: string, kind: MediaKind): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const accent = kind === "video" ? "#60a5fa" : kind === "gif" ? "#f472b6" : "#34d399";
  const label = escapeXml(kind.toUpperCase());
  const title = escapeXml(filename);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <rect x="28" y="28" width="584" height="304" rx="28" fill="none" stroke="${accent}" stroke-width="6" opacity="0.8"/>
  <circle cx="320" cy="150" r="52" fill="${accent}" opacity="0.18"/>
  <path d="M300 120l58 34-58 34z" fill="${accent}"/>
  <text x="320" y="242" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="#f8fafc">${label}</text>
  <text x="320" y="286" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" fill="#cbd5e1">${title.slice(0, 42)}</text>
</svg>`;
  await fs.writeFile(filePath, svg, "utf8");
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "\"":
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

function mimeForExtension(extension: MediaExtension): string {
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "mp4":
    default:
      return "video/mp4";
  }
}

export { DATABASE_PATH, SETTINGS_PATH, THUMBNAILS_DIR, UPLOADS_DIR };
