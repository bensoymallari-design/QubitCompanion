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
}

export interface ResolumeClipTarget {
  layer: number;
  clip: number;
}
