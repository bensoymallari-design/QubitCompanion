import type { MediaExtension, MediaKind } from "@/types/media";

export const STORAGE_DIR = "storage";
export const UPLOADS_DIR = `${STORAGE_DIR}/uploads`;
export const THUMBNAILS_DIR = `${STORAGE_DIR}/thumbnails`;
export const DATABASE_PATH = `${STORAGE_DIR}/database.json`;
export const SETTINGS_PATH = `${STORAGE_DIR}/settings.json`;

export const SUPPORTED_EXTENSIONS: MediaExtension[] = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "mp4",
  "mov",
  "webm"
];

export const SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm"
]);

export const MEDIA_KIND_BY_EXTENSION: Record<MediaExtension, MediaKind> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "gif",
  mp4: "video",
  mov: "video",
  webm: "video"
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 * 1024;
