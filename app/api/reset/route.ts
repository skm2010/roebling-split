import { NextResponse } from "next/server";
import { resetClaims } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  await resetClaims();
  return NextResponse.json({ ok: true });
}
