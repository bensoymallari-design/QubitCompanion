export interface ResolumeSettings {
  ip: string;
  port: number;
}

export interface ResolumeStatus {
  connected: boolean;
  url: string;
  message: string;
  checkedAt: string;
}

export interface ResolumeLayer {
  id: number | string;
  name: string;
  clipCount?: number;
}

export interface ResolumeClip {
  id: number | string;
  name: string;
  layerId: number | string;
  connected?: boolean;
}

export interface ResolumeLoadRequest {
  fileId: string;
  layer: number;
  clip: number;
  trigger?: boolean;
}

export interface ResolumeClipTarget {
  layer: number;
  clip: number;
}

export interface ResolumeSource {
  id: string;
  name: string;
  type: string;
  path?: string;
  uri?: string;
  category?: string;
  isNdi: boolean;
}

export interface ResolumeSourceLoadRequest {
  source: ResolumeSource;
  layer: number;
  clip: number;
  trigger?: boolean;
}

export type ResolumeControlScope = "composition" | "layer" | "clip";

export type ResolumeParameterValue = string | number | boolean | null;

export interface ResolumeParameterOption {
  label: string;
  value: string | number | boolean;
}

export interface ResolumeParameter {
  id: string;
  name: string;
  path: string;
  value: ResolumeParameterValue;
  min?: number;
  max?: number;
  type?: string;
  options?: ResolumeParameterOption[];
  group: "transform" | "effect" | "audio" | "transport" | "other";
}

export interface ResolumeOutputPreset {
  id: string;
  name: string;
  createdAt: string;
  parameters: Array<{
    id: string;
    name: string;
    path: string;
    value: ResolumeParameterValue;
  }>;
}

export interface ResolumeEffect {
  id: string;
  name: string;
  path?: string;
}

export interface ResolumeControlTarget {
  scope: ResolumeControlScope;
  layer?: number;
  clip?: number;
}
