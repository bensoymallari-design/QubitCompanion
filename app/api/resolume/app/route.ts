import { jsonError, jsonOk } from "@/lib/api";
import { assertSystemControlsAllowed, runResolumeAppAction, type ResolumeAppAction } from "@/lib/system-controls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIRMATION_BY_ACTION: Record<ResolumeAppAction, string> = {
  save: "SAVE",
  "save-close": "SAVE CLOSE",
  "close-without-save": "CLOSE WITHOUT SAVE"
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: ResolumeAppAction; confirmation?: string };

    if (!body.action || !(body.action in CONFIRMATION_BY_ACTION)) {
      return jsonError(new Error("Invalid Resolume app action"), 400);
    }

    await assertSystemControlsAllowed(body.confirmation, CONFIRMATION_BY_ACTION[body.action]);
    const message = await runResolumeAppAction(body.action);
    return jsonOk({ message });
  } catch (error) {
    return jsonError(error, 400);
  }
}
