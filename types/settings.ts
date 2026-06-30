export interface AppSettings {
  resolumeIp: string;
  resolumePort: number;
  uploadFolder: string;
  autoRefresh: boolean;
  darkMode: boolean;
  allowSystemControls: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  resolumeIp: "127.0.0.1",
  resolumePort: 8080,
  uploadFolder: "storage/uploads",
  autoRefresh: true,
  darkMode: true,
  allowSystemControls: false
};
