import { NextRequest, NextResponse } from "next/server";
import { readClaims, writeClaims, readPeople, ClaimsState } from "@/lib/store";
import { ITEMS } from "@/lib/bill";

export const dynamic = "force-dynamic";

export async function GET() {
  const [claims, people] = await Promise.all([readClaims(), readPeople()]);
  return NextResponse.json({ claims, people });
}

// Body: { itemId, personId, action: 'claim' | 'unclaim' }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, personId, action } = body as {
      itemId: string;
      personId: string;
      action: "claim" | "unclaim";
    };

    // Validate
    if (!ITEMS.find((i) => i.id === itemId)) {
      return NextResponse.json({ error: "invalid item" }, { status: 400 });
    }
    const people = await readPeople();
    if (!people.find((p) => p.id === personId)) {
      return NextResponse.json({ error: "invalid person" }, { status: 400 });
    }
    if (action !== "claim" && action !== "unclaim") {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    const claims: ClaimsState = await readClaims();
    const current = new Set(claims[itemId] || []);
    if (action === "claim") current.add(personId);
    else current.delete(personId);

    if (current.size === 0) delete claims[itemId];
    else claims[itemId] = Array.from(current);

    await writeClaims(claims);
    return NextResponse.json({ claims });
  } catch (e) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
