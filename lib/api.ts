import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown, status = 500): NextResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return NextResponse.json({ error: message }, { status });
}

export function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }

  return value === "true" || value === "1";
}

export function parseNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
