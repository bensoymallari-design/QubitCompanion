import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { jsonError, jsonOk } from "@/lib/api";
import { configuredUploadFolderPath } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

export async function POST() {
  try {
    const folder = await configuredUploadFolderPath();
    const command = process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
    await execFileAsync(command, [folder]);
    return jsonOk({ message: `Opened ${folder}` });
  } catch (error) {
    return jsonError(error, 500);
  }
}
