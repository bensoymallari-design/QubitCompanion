export interface ResolumeTarget {
  id: string;
  name: string;
  ip: string;
  port: number;
}

export interface AppSettings {
  resolumeIp: string;
  resolumePort: number;
  resolumeTargets: ResolumeTarget[];
  uploadFolder: string;
  autoRefresh: boolean;
  darkMode: boolean;
  allowSystemControls: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  resolumeIp: "127.0.0.1",
  resolumePort: 8080,
  resolumeTargets: [
    {
      id: "local",
      name: "Local Resolume",
      ip: "127.0.0.1",
      port: 8080
    }
  ],
  uploadFolder: "storage/uploads",
  autoRefresh: true,
  darkMode: true,
  allowSystemControls: false
};
