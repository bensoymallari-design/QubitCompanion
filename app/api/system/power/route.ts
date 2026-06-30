import { jsonError, jsonOk } from "@/lib/api";
import { assertSystemControlsAllowed, runPowerAction, type PowerAction } from "@/lib/system-controls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIRMATION_BY_ACTION: Record<PowerAction, string> = {
  shutdown: "SHUTDOWN",
  restart: "RESTART"
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: PowerAction; confirmation?: string };

    if (!body.action || !(body.action in CONFIRMATION_BY_ACTION)) {
      return jsonError(new Error("Invalid power action"), 400);
    }

    await assertSystemControlsAllowed(body.confirmation, CONFIRMATION_BY_ACTION[body.action]);
    const message = await runPowerAction(body.action);
    return jsonOk({ message });
  } catch (error) {
    return jsonError(error, 400);
  }
}
