import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readSettings } from "@/lib/storage";

const execFileAsync = promisify(execFile);

export type ResolumeAppAction = "save" | "save-close" | "close-without-save";
export type PowerAction = "shutdown" | "restart";

export async function assertSystemControlsAllowed(confirmation: string | undefined, expected: string): Promise<void> {
  const settings = await readSettings();

  if (!settings.allowSystemControls) {
    throw new Error("System controls are disabled. Enable them in Settings first.");
  }

  if (confirmation !== expected) {
    throw new Error(`Type ${expected} to confirm this action.`);
  }
}

export async function runResolumeAppAction(action: ResolumeAppAction): Promise<string> {
  if (process.platform !== "win32") {
    throw new Error("Resolume app controls are only available on Windows.");
  }

  if (action === "save") {
    await runPowerShell(saveResolumeScript(false));
    return "Save command sent to Resolume.";
  }

  if (action === "save-close") {
    await runPowerShell(saveResolumeScript(true));
    return "Save and close command sent to Resolume.";
  }

  await runPowerShell(forceCloseResolumeScript());
  return "Resolume force close command sent.";
}

export async function runPowerAction(action: PowerAction): Promise<string> {
  if (process.platform !== "win32") {
    throw new Error("Shutdown and restart controls are only available on Windows.");
  }

  if (action === "restart") {
    await execFileAsync("shutdown.exe", ["/r", "/t", "10", "/c", "Restart requested from Qubit Companion"]);
    return "Restart scheduled in 10 seconds.";
  }

  await execFileAsync("shutdown.exe", ["/s", "/t", "10", "/c", "Shutdown requested from Qubit Companion"]);
  return "Shutdown scheduled in 10 seconds.";
}

async function runPowerShell(command: string): Promise<void> {
  await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
    windowsHide: true
  });
}

function saveResolumeScript(closeAfterSave: boolean): string {
  const close = closeAfterSave
    ? `
Start-Sleep -Milliseconds 1200
$processes | ForEach-Object {
  try {
    if ($_.MainWindowHandle -ne 0) { [void]$_.CloseMainWindow() }
  } catch {}
}
Start-Sleep -Milliseconds 800
$quitDialogProcess = Get-Process | Where-Object { $_.ProcessName -match "Arena|Resolume|Avenue" -and $_.MainWindowTitle -match "Quit|Resolume|Arena|Avenue" } | Select-Object -First 1
if ($quitDialogProcess) {
  [void]$shell.AppActivate($quitDialogProcess.Id)
  Start-Sleep -Milliseconds 300
}
# Resolume's quit dialog highlights "Save & Quit" by default after a graceful close.
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 1200
$remaining = Get-Process | Where-Object { $_.ProcessName -match "Arena|Resolume|Avenue" }
if ($remaining) {
  $remaining | ForEach-Object {
    try {
      if ($_.MainWindowHandle -ne 0) { [void]$_.CloseMainWindow() }
    } catch {}
  }
}
`
    : "";

  return `
$ErrorActionPreference = "SilentlyContinue"
$processes = Get-Process | Where-Object { $_.ProcessName -match "Arena|Resolume|Avenue" }
if (-not $processes) { throw "Resolume process was not found." }
Add-Type -AssemblyName System.Windows.Forms
$shell = New-Object -ComObject WScript.Shell
$target = $processes | Where-Object { $_.MainWindowTitle } | Select-Object -First 1
if ($target) {
  [void]$shell.AppActivate($target.Id)
  Start-Sleep -Milliseconds 300
}
[System.Windows.Forms.SendKeys]::SendWait("^s")
${close}
`;
}

function forceCloseResolumeScript(): string {
  return `
$ErrorActionPreference = "SilentlyContinue"
$processes = Get-Process | Where-Object { $_.ProcessName -match "Arena|Resolume|Avenue" }
if (-not $processes) { throw "Resolume process was not found." }
$processes | Stop-Process -Force
`;
}
