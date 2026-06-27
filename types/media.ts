export type MediaKind = "image" | "video" | "gif";

export type MediaExtension = "png" | "jpg" | "jpeg" | "gif" | "mp4" | "mov" | "webm";

export interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  extension: MediaExtension;
  mimeType: string;
  kind: MediaKind;
  size: number;
  relativePath: string;
  thumbnailPath: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MediaDatabase {
  files: MediaFile[];
}

export type MediaSort = "newest" | "oldest" | "name" | "size";

export interface MediaListQuery {
  search?: string;
  kind?: MediaKind | "all";
  favorites?: boolean;
  sort?: MediaSort;
  page?: number;
  pageSize?: number;
}

export interface MediaListResponse {
  files: MediaFile[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UploadResponse {
  files: MediaFile[];
}
