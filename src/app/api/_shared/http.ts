import { NextResponse } from "next/server";

export function jsonError(error: string, status: number) {
  if (status >= 500) console.error(`[API ${status}]`, error);
  return NextResponse.json({ error }, { status });
}
