import path from "node:path";
import { pathToFileURL } from "node:url";
import { getMedia, readSettings } from "@/lib/storage";
import type { ResolumeClip, ResolumeClipTarget, ResolumeLayer, ResolumeLoadRequest, ResolumeStatus } from "@/types/resolume";

const REQUEST_TIMEOUT_MS = 5000;

export class ResolumeService {
  private readonly baseUrl: string;

  constructor(private readonly ip: string, private readonly port: number) {
    this.baseUrl = `http://${ip}:${port}/api/v1`;
  }

  static async fromSettings(): Promise<ResolumeService> {
    const settings = await readSettings();
    return new ResolumeService(settings.resolumeIp, settings.resolumePort);
  }

  async status(): Promise<ResolumeStatus> {
    try {
      await this.request("/composition");
      return {
        connected: true,
        url: this.baseUrl,
        message: "Connected to Resolume Arena",
        checkedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        connected: false,
        url: this.baseUrl,
        message: error instanceof Error ? error.message : "Resolume is offline",
        checkedAt: new Date().toISOString()
      };
    }
  }

  async composition(): Promise<unknown> {
    return this.request("/composition");
  }

  async layers(): Promise<ResolumeLayer[]> {
    const composition = await this.composition();
    const layers = extractArray((composition as Record<string, unknown>).layers);

    return layers.map((layer, index) => {
      const value = layer as Record<string, unknown>;
      const clips = extractArray(value.clips);
      const name = stringValue(value.name);

      return {
        id: stringValue(value.id) ?? index + 1,
        name: name ? `Layer ${index + 1} - ${name}` : `Layer ${index + 1}`,
        clipCount: clips.length
      };
    });
  }

  async clips(layerId?: number): Promise<ResolumeClip[]> {
    const composition = await this.composition();
    const layers = extractArray((composition as Record<string, unknown>).layers);
    const clips: ResolumeClip[] = [];

    layers.forEach((layer, layerIndex) => {
      const layerNumber = layerIndex + 1;
      if (layerId && layerNumber !== layerId) {
        return;
      }

      extractArray((layer as Record<string, unknown>).clips).forEach((clip, clipIndex) => {
        const value = clip as Record<string, unknown>;
        const name = stringValue(value.name);
        clips.push({
          id: stringValue(value.id) ?? clipIndex + 1,
          name: name ? `Clip ${clipIndex + 1} - ${name}` : `Clip ${clipIndex + 1}`,
          layerId: layerNumber,
          connected: Boolean(value.connected)
        });
      });
    });

    return clips;
  }

  async loadMedia(request: ResolumeLoadRequest): Promise<{ message: string }> {
    const media = await getMedia(request.fileId);

    if (!media) {
      throw new Error("Media file not found");
    }

    const absolutePath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), media.relativePath);
    const fileUri = pathToFileURL(absolutePath).href;
    const endpoint = `/composition/layers/${request.layer}/clips/${request.clip}`;

    for (const action of ["openfile", "open"]) {
      try {
        await this.request(`${endpoint}/${action}`, {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: fileUri
        });
        return { message: `Loaded ${media.filename} into layer ${request.layer}, clip ${request.clip}` };
      } catch (error) {
        if (action === "open") {
          throw error;
        }
      }
    }

    throw new Error("Resolume did not accept the media file path");
  }

  async triggerClip(target: ResolumeClipTarget): Promise<{ message: string }> {
    await this.request(`/composition/layers/${target.layer}/clips/${target.clip}/connect`, { method: "POST" });
    return { message: `Triggered layer ${target.layer}, clip ${target.clip}` };
  }

  async stopClip(target: ResolumeClipTarget): Promise<{ message: string }> {
    await this.request(`/composition/layers/${target.layer}/clips/${target.clip}/disconnect`, { method: "POST" });
    return { message: `Stopped layer ${target.layer}, clip ${target.clip}` };
  }

  async clearLayer(layer: number): Promise<{ message: string }> {
    await this.request(`/composition/layers/${layer}/clear`, { method: "POST" });
    return { message: `Cleared layer ${layer}` };
  }

  private async request<T = unknown>(pathname: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}${pathname}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init.headers ?? {})
        },
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Resolume API ${response.status}: ${body || response.statusText}`);
      }

      const text = await response.text();
      const contentType = response.headers.get("content-type") ?? "";

      if (!text) {
        return {} as T;
      }

      return (contentType.includes("json") ? JSON.parse(text) : text) as T;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new Error("Resolume API request timed out");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (value && typeof value === "object" && "value" in value) {
    const nested = (value as { value?: unknown }).value;
    return typeof nested === "string" || typeof nested === "number" ? String(nested) : undefined;
  }

  return undefined;
}
