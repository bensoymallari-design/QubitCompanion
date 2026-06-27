import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";
import { getMedia, readSettings, resolveMediaPath } from "@/lib/storage";
import type {
  ResolumeClip,
  ResolumeClipTarget,
  ResolumeControlTarget,
  ResolumeEffect,
  ResolumeLayer,
  ResolumeLoadRequest,
  ResolumeParameter,
  ResolumeParameterValue,
  ResolumeStatus
} from "@/types/resolume";

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

    const absolutePath = resolveMediaPath(media.relativePath);
    await fs.access(absolutePath);
    const fileUris = resolumeFileUriVariants(absolutePath);
    const endpoint = `/composition/layers/${request.layer}/clips/${request.clip}`;
    let loaded = false;
    let lastError: unknown;

    for (const action of ["openfile", "open"]) {
      for (const fileUri of fileUris) {
        try {
          await this.request(`${endpoint}/${action}`, {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: fileUri
          });
          loaded = true;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (loaded) {
        break;
      }
    }

    if (!loaded) {
      const detail = lastError instanceof Error ? lastError.message : "unknown error";
      throw new Error(
        `Resolume could not open this file from disk. The file exists at "${absolutePath}", but Resolume rejected it. ` +
          `If this is a WebM from a phone, its codec may not be supported by Resolume; try converting it to H.264 MP4 or test by dragging the file directly into Resolume. Last API error: ${detail}`
      );
    }

    if (request.trigger) {
      await delay(400);
      await this.triggerClip({ layer: request.layer, clip: request.clip });
      return { message: `Loaded and triggered ${media.filename} in layer ${request.layer}, clip ${request.clip}` };
    }

    return { message: `Loaded ${media.filename} into layer ${request.layer}, clip ${request.clip}` };
  }

  async triggerClip(target: ResolumeClipTarget): Promise<{ message: string }> {
    const endpoint = `/composition/layers/${target.layer}/clips/${target.clip}/connect`;
    const pressReleasePairs: Array<{ press: RequestInit; release: RequestInit }> = [
      {
        press: { method: "POST", headers: { "content-type": "text/plain" }, body: "true" },
        release: { method: "POST", headers: { "content-type": "text/plain" }, body: "false" }
      },
      {
        press: { method: "POST", body: JSON.stringify(true) },
        release: { method: "POST", body: JSON.stringify(false) }
      },
      {
        press: { method: "POST", body: JSON.stringify({ value: true }) },
        release: { method: "POST", body: JSON.stringify({ value: false }) }
      }
    ];
    let lastError: unknown;

    for (const pair of pressReleasePairs) {
      try {
        await this.request(endpoint, pair.press);
        await delay(80);
        await this.request(endpoint, pair.release).catch(() => undefined);
        return { message: `Triggered layer ${target.layer}, clip ${target.clip}` };
      } catch (error) {
        lastError = error;
      }
    }

    try {
      await this.request(endpoint, { method: "POST" });
      return { message: `Triggered layer ${target.layer}, clip ${target.clip}` };
    } catch (error) {
      lastError = error;
    }

    throw lastError instanceof Error ? lastError : new Error("Could not trigger Resolume clip");
  }

  async stopClip(target: ResolumeClipTarget): Promise<{ message: string }> {
    const endpoint = `/composition/layers/${target.layer}/clips/${target.clip}/connect`;
    const clearEndpoint = `/composition/layers/${target.layer}/clips/${target.clip}/clear`;
    const payloads: RequestInit[] = [
      { method: "POST", headers: { "content-type": "text/plain" }, body: "false" },
      { method: "POST", body: JSON.stringify(false) },
      { method: "POST", body: JSON.stringify({ value: false }) }
    ];
    let lastError: unknown;

    try {
      await this.request(clearEndpoint, { method: "POST" });
      return { message: `Cleared layer ${target.layer}, clip ${target.clip}` };
    } catch (error) {
      lastError = error;
    }

    try {
      await this.request(clearEndpoint, { method: "DELETE" });
      return { message: `Cleared layer ${target.layer}, clip ${target.clip}` };
    } catch (error) {
      lastError = error;
    }

    for (const payload of payloads) {
      try {
        await this.request(endpoint, payload);
        return { message: `Stopped layer ${target.layer}, clip ${target.clip}` };
      } catch (error) {
        lastError = error;
      }
    }

    try {
      const connectedParameter = (await this.parameters({ scope: "clip", layer: target.layer, clip: target.clip })).find((parameter) =>
        `${parameter.path} ${parameter.name}`.toLowerCase().includes("connected")
      );

      if (connectedParameter) {
        await this.updateParameter(connectedParameter.id, false);
        return { message: `Stopped layer ${target.layer}, clip ${target.clip}` };
      }
    } catch (error) {
      lastError = error;
    }

    try {
      await this.request(`/composition/layers/${target.layer}/clear`, { method: "POST" });
      return { message: `Stopped layer ${target.layer}` };
    } catch (error) {
      lastError = error;
    }

    throw lastError instanceof Error ? lastError : new Error("Could not stop Resolume clip");
  }

  async clearLayer(layer: number): Promise<{ message: string }> {
    await this.request(`/composition/layers/${layer}/clear`, { method: "POST" });
    return { message: `Cleared layer ${layer}` };
  }

  async clearMediaReferences(fileId: string): Promise<{ cleared: number }> {
    const media = await getMedia(fileId);

    if (!media) {
      return { cleared: 0 };
    }

    const composition = (await this.composition()) as Record<string, unknown>;
    const absolutePath = resolveMediaPath(media.relativePath).toLowerCase();
    const fileUri = pathToFileURL(absolutePath).href.toLowerCase();
    const identifiers = [media.id, media.filename, media.originalName, media.relativePath, absolutePath, fileUri].map((value) => value.toLowerCase());
    const layers = extractArray(composition.layers);
    let cleared = 0;

    for (const [layerIndex, layer] of layers.entries()) {
      const clips = extractArray((layer as Record<string, unknown>).clips);

      for (const [clipIndex, clip] of clips.entries()) {
        const serialized = JSON.stringify(clip).toLowerCase();

        if (identifiers.some((identifier) => identifier && serialized.includes(identifier))) {
          const target = { layer: layerIndex + 1, clip: clipIndex + 1 };
          await this.clearClip(target).catch(() => this.stopClip(target));
          cleared += 1;
        }
      }
    }

    return { cleared };
  }

  async clearClip(target: ResolumeClipTarget): Promise<{ message: string }> {
    const endpoint = `/composition/layers/${target.layer}/clips/${target.clip}/clear`;
    let lastError: unknown;

    for (const method of ["POST", "DELETE"]) {
      try {
        await this.request(endpoint, { method });
        return { message: `Cleared layer ${target.layer}, clip ${target.clip}` };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Could not clear Resolume clip");
  }

  async parameters(target: ResolumeControlTarget): Promise<ResolumeParameter[]> {
    const composition = (await this.composition()) as Record<string, unknown>;
    const summaryNode = targetNode(composition, target);
    let directNode: Record<string, unknown> | null = null;

    try {
      directNode = (await this.request(targetPath(target))) as Record<string, unknown>;
    } catch {
      directNode = null;
    }

    if (!summaryNode && !directNode) {
      throw new Error("Resolume target was not found in the composition");
    }

    return dedupeParameters([...extractParameters(directNode ?? {}), ...extractParameters(summaryNode ?? {})]).sort(
      (a, b) => groupRank(a.group) - groupRank(b.group) || a.name.localeCompare(b.name)
    );
  }

  async updateParameter(id: string, value: ResolumeParameterValue): Promise<{ message: string }> {
    if (!id) {
      throw new Error("Parameter id is required");
    }

    const payloads = [{ value }, value];
    let lastError: unknown;

    for (const payload of payloads) {
      try {
        await this.request(`/parameter/by-id/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        return { message: "Resolume parameter updated" };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Resolume parameter update failed");
  }

  async effects(): Promise<ResolumeEffect[]> {
    const candidates = ["/effects", "/composition/effects"];
    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        const data = await this.request(candidate);
        return extractEffects(data);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Could not load Resolume effects");
  }

  async addEffect(target: ResolumeControlTarget, effect: string): Promise<{ message: string }> {
    if (!effect.trim()) {
      throw new Error("Effect name or id is required");
    }

    const basePath = targetPath(target);
    const body = effect.trim();
    const payloads: RequestInit[] = [
      { method: "POST", headers: { "content-type": "text/plain" }, body },
      { method: "POST", body: JSON.stringify({ id: body }) },
      { method: "POST", body: JSON.stringify({ effect: body, id: body, name: body }) },
      { method: "POST", body: JSON.stringify({ name: body }) }
    ];
    const endpoints = [
      `${basePath}/effects/add`,
      `${basePath}/video/effects/add`,
      `${basePath}/audio/effects/add`,
      `${basePath}/effects/video/add`,
      `${basePath}/effects/audio/add`
    ];
    let lastError: unknown;

    for (const endpoint of endpoints) {
      for (const payload of payloads) {
        try {
          await this.request(endpoint, payload);
          return { message: `Added effect ${body}` };
        } catch (error) {
          lastError = error;
        }
      }
    }

    throw new Error(
      `Could not add effect through this Resolume REST API. Last error: ${
        lastError instanceof Error ? lastError.message : "unknown error"
      }. Try adding the effect in Resolume first; its parameters will appear here after refresh.`
    );
  }

  async removeEffect(target: ResolumeControlTarget, effectIndex: number): Promise<{ message: string }> {
    if (!effectIndex || effectIndex < 1) {
      throw new Error("Effect index must be 1 or greater");
    }

    const basePath = targetPath(target);
    const endpoints = [
      `${basePath}/effects/${effectIndex}/remove`,
      `${basePath}/effects/${effectIndex}`,
      `${basePath}/video/effects/${effectIndex}/remove`,
      `${basePath}/video/effects/${effectIndex}`,
      `${basePath}/audio/effects/${effectIndex}/remove`,
      `${basePath}/audio/effects/${effectIndex}`
    ];
    let lastError: unknown;

    for (const endpoint of endpoints) {
      for (const method of ["POST", "DELETE"]) {
        try {
          await this.request(endpoint, { method });
          return { message: `Removed effect ${effectIndex}` };
        } catch (error) {
          lastError = error;
        }
      }
    }

    throw new Error(`Could not remove effect slot ${effectIndex}. Last error: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
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
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["items", "value", "clips", "layers", "effects"]) {
      if (Array.isArray(record[key])) {
        return record[key];
      }
    }
  }

  return [];
}

function targetNode(composition: Record<string, unknown>, target: ResolumeControlTarget): Record<string, unknown> | null {
  if (target.scope === "composition") {
    return composition;
  }

  const layers = extractArray(composition.layers);
  const layer = layers[(target.layer ?? 1) - 1] as Record<string, unknown> | undefined;

  if (target.scope === "layer") {
    return layer ?? null;
  }

  const clips = extractArray(layer?.clips);
  return (clips[(target.clip ?? 1) - 1] as Record<string, unknown> | undefined) ?? null;
}

function targetPath(target: ResolumeControlTarget): string {
  if (target.scope === "composition") {
    return "/composition";
  }

  if (!target.layer) {
    throw new Error("Layer is required");
  }

  if (target.scope === "layer") {
    return `/composition/layers/${target.layer}`;
  }

  if (!target.clip) {
    throw new Error("Clip is required");
  }

  return `/composition/layers/${target.layer}/clips/${target.clip}`;
}

function extractParameters(node: Record<string, unknown>, pathPrefix = ""): ResolumeParameter[] {
  const parameters: ResolumeParameter[] = [];

  for (const [key, value] of Object.entries(node)) {
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

    if (isParameterObject(value)) {
      const parameter = value as Record<string, unknown>;
      const id = stringValue(parameter.id);
      const name = stringValue(parameter.name) ?? humanize(key);

      if (id) {
        parameters.push({
          id,
          name,
          path: currentPath,
          value: parameterValue(parameter.value),
          min: numberValue(parameter.min),
          max: numberValue(parameter.max),
          type: stringValue(parameter.type),
          group: classifyParameter(`${currentPath} ${name}`)
        });
      }
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      parameters.push(...extractParameters(value as Record<string, unknown>, currentPath));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === "object") {
          parameters.push(...extractParameters(item as Record<string, unknown>, `${currentPath}.${index + 1}`));
        }
      });
    }
  }

  return dedupeParameters(parameters);
}

function isParameterObject(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Boolean(record.id && "value" in record);
}

function dedupeParameters(parameters: ResolumeParameter[]): ResolumeParameter[] {
  const seen = new Set<string>();
  return parameters.filter((parameter) => {
    if (seen.has(parameter.id)) {
      return false;
    }
    seen.add(parameter.id);
    return true;
  });
}

function parameterValue(value: unknown): ResolumeParameterValue {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value && typeof value === "object" && "value" in value) {
    return parameterValue((value as { value?: unknown }).value);
  }

  return null;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (value && typeof value === "object" && "value" in value) {
    return numberValue((value as { value?: unknown }).value);
  }

  return undefined;
}

function classifyParameter(value: string): ResolumeParameter["group"] {
  const text = value.toLowerCase();

  if (/transform|position|scale|rotation|anchor|width|height|crop|flip|mirror|expand|perspective|slice/.test(text)) {
    return "transform";
  }

  if (/effect|bypass|blend|opacity|brightness|contrast|hue|saturation|blur|distort|colorize/.test(text)) {
    return "effect";
  }

  if (/audio|volume|pan|gain/.test(text)) {
    return "audio";
  }

  if (/transport|play|speed|direction|timeline|beat|bpm/.test(text)) {
    return "transport";
  }

  return "other";
}

function groupRank(group: ResolumeParameter["group"]): number {
  return ["transform", "effect", "audio", "transport", "other"].indexOf(group);
}

function extractEffects(data: unknown): ResolumeEffect[] {
  const effects = Array.isArray(data) ? data : extractArray((data as Record<string, unknown>)?.effects ?? (data as Record<string, unknown>)?.value);

  return effects
    .map((effect, index) => {
      const record = effect as Record<string, unknown>;
      return {
        id: stringValue(record.id) ?? stringValue(record.identifier) ?? stringValue(record.name) ?? String(index + 1),
        name: stringValue(record.name) ?? stringValue(record.displayName) ?? `Effect ${index + 1}`,
        path: stringValue(record.path)
      };
    })
    .filter((effect) => effect.name);
}

function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolumeFileUriVariants(absolutePath: string): string[] {
  const normalized = absolutePath.replace(/\\/g, "/");
  const encoded = pathToFileURL(absolutePath).href;
  const variants = new Set<string>([encoded]);

  if (/^[a-zA-Z]:\//.test(normalized)) {
    variants.add(`file:///${normalized}`);
    variants.add(`file://${normalized}`);
  } else if (normalized.startsWith("//")) {
    variants.add(`file:${normalized}`);
  } else {
    variants.add(`file://${normalized}`);
  }

  variants.add(decodeURI(encoded));
  return Array.from(variants);
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
