import { promises as fs } from "node:fs";
import { execFile, spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { ResolumeAdvancedOutputPreset } from "@/types/resolume";

const execFileAsync = promisify(execFile);

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

export async function revealAdvancedOutputPreset(filePath: string): Promise<string> {
  if (!filePath.toLowerCase().endsWith(".xml")) {
    throw new Error("Only Resolume Advanced Output .xml preset files can be revealed.");
  }

  await fs.access(filePath);

  if (process.platform === "win32") {
    launchDetached("explorer.exe", [`/select,${filePath}`]);
    return "Preset folder opened. Apply the preset inside Resolume Advanced Output.";
  }

  const folder = path.dirname(filePath);
  const command = process.platform === "darwin" ? "open" : "xdg-open";
  await execFileAsync(command, [folder]);
  return "Preset folder opened.";
}

export async function applyAdvancedOutputPreset(filePath: string): Promise<string> {
  if (process.platform !== "win32") {
    throw new Error("Applying Resolume Advanced Output presets is only available on Windows.");
  }

  if (!filePath.toLowerCase().endsWith(".xml")) {
    throw new Error("Only Resolume Advanced Output .xml preset files can be applied.");
  }

  await fs.access(filePath);
  const presetName = path.basename(filePath, path.extname(filePath));
  await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", advancedOutputApplyScript(presetName)], {
    windowsHide: true,
    timeout: 15000
  });

  return `Requested Advanced Output preset "${presetName}" in Resolume.`;
}

function launchDetached(command: string, args: string[]): void {
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });
  child.unref();
}

function advancedOutputApplyScript(presetName: string): string {
  const escapedPreset = presetName.replace(/'/g, "''");

  return `
$ErrorActionPreference = "Stop"
$presetName = '${escapedPreset}'
$processes = Get-Process | Where-Object { $_.ProcessName -match "Arena|Resolume|Avenue" }
if (-not $processes) { throw "Resolume process was not found." }

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$shell = New-Object -ComObject WScript.Shell
$target = $processes | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
if ($target) {
  [void]$shell.AppActivate($target.Id)
  Start-Sleep -Milliseconds 300
}

# Open Advanced Output. Resolume Windows shortcut: Ctrl+Shift+A.
[System.Windows.Forms.SendKeys]::SendWait("^+a")
Start-Sleep -Milliseconds 1200

$root = [System.Windows.Automation.AutomationElement]::RootElement
$windowCondition = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
  [System.Windows.Automation.ControlType]::Window
)
$windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $windowCondition)
$resolumeIds = @($processes | ForEach-Object { $_.Id })
$targetWindow = $null

foreach ($window in $windows) {
  if ($resolumeIds -contains $window.Current.ProcessId -and $window.Current.Name -match "Advanced|Output|Resolume|Arena|Avenue") {
    $targetWindow = $window
    break
  }
}

if (-not $targetWindow) {
  throw "Advanced Output window was not found. Open Advanced Output in Resolume once, then try again."
}

$comboCondition = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
  [System.Windows.Automation.ControlType]::ComboBox
)
$combos = $targetWindow.FindAll([System.Windows.Automation.TreeScope]::Descendants, $comboCondition)
if ($combos.Count -eq 0) {
  throw "No preset dropdown was exposed by Resolume to Windows UI Automation."
}

$listItemCondition = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
  [System.Windows.Automation.ControlType]::ListItem
)

foreach ($combo in $combos) {
  try {
    $expandPattern = $combo.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
    $expandPattern.Expand()
    Start-Sleep -Milliseconds 350
  } catch {}

  $items = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $listItemCondition)
  foreach ($item in $items) {
    if ($item.Current.Name -eq $presetName) {
      try {
        $selectPattern = $item.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
        $selectPattern.Select()
      } catch {
        try {
          $invokePattern = $item.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
          $invokePattern.Invoke()
        } catch {
          [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        }
      }
      Start-Sleep -Milliseconds 500
      return
    }
  }

  try {
    $expandPattern = $combo.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
    $expandPattern.Collapse()
  } catch {}
}

throw "Preset '$presetName' was not found in the visible Resolume Advanced Output preset dropdown."
`;
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
