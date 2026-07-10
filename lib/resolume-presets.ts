import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ResolumeAdvancedOutputPreset } from "@/types/resolume";

const SCREEN_SETUP_RELATIVE_PATHS = [
  path.join("presets", "screensetup"),
  path.join("Presets", "screensetup"),
  path.join("presets", "advancedoutput"),
  path.join("Presets", "Advanced Output")
];

export async function listAdvancedOutputPresets(): Promise<ResolumeAdvancedOutputPreset[]> {
  const folders = await candidatePresetFolders();
  const presets: ResolumeAdvancedOutputPreset[] = [];

  for (const folder of folders) {
    try {
      const entries = await fs.readdir(folder, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".xml")) {
          continue;
        }

        const filePath = path.join(folder, entry.name);
        const stats = await fs.stat(filePath);
        presets.push({
          name: path.basename(entry.name, path.extname(entry.name)),
          filePath,
          folderPath: folder,
          updatedAt: stats.mtime.toISOString()
        });
      }
    } catch {
      // Missing Resolume folders are normal on fresh installs or non-Windows validation machines.
    }
  }

  return dedupePresets(presets).sort((a, b) => a.name.localeCompare(b.name));
}

async function candidatePresetFolders(): Promise<string[]> {
  const documents = candidateDocumentsFolders();
  const folders = new Set<string>();

  for (const documentsFolder of documents) {
    const resolumeFolders = await resolumeDocumentFolders(documentsFolder);

    for (const resolumeFolder of resolumeFolders) {
      for (const relativePath of SCREEN_SETUP_RELATIVE_PATHS) {
        folders.add(joinExternalPath(resolumeFolder, relativePath));
      }
    }
  }

  return Array.from(folders);
}

function candidateDocumentsFolders(): string[] {
  const home = os.homedir();
  const userProfile = process.env.USERPROFILE;
  const candidates = [
    userProfile ? joinExternalPath(userProfile, "Documents") : "",
    userProfile ? joinExternalPath(userProfile, "My Documents") : "",
    home ? joinExternalPath(home, "Documents") : "",
    home ? joinExternalPath(home, "My Documents") : ""
  ];

  return Array.from(new Set(candidates.filter(Boolean)));
}

async function resolumeDocumentFolders(documentsFolder: string): Promise<string[]> {
  const folders = new Set<string>();
  const knownNames = [
    "Resolume Arena",
    "Resolume Avenue",
    "Resolume Arena 7",
    "Resolume Avenue 7",
    "Resolume Avenue-Arena 5"
  ];

  for (const name of knownNames) {
    folders.add(joinExternalPath(documentsFolder, name));
  }

  try {
    const entries = await fs.readdir(documentsFolder, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.toLowerCase().includes("resolume")) {
        folders.add(joinExternalPath(documentsFolder, entry.name));
      }
    }
  } catch {
    // Ignore inaccessible Documents folders.
  }

  return Array.from(folders);
}

function joinExternalPath(base: string, ...parts: string[]): string {
  return path.join(/*turbopackIgnore: true*/ base, ...parts);
}

function dedupePresets(presets: ResolumeAdvancedOutputPreset[]): ResolumeAdvancedOutputPreset[] {
  const seen = new Set<string>();
  return presets.filter((preset) => {
    const key = preset.filePath.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
