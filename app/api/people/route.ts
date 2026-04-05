import { NextRequest, NextResponse } from "next/server";
import { readPeople, addPerson } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const people = await readPeople();
  return NextResponse.json({ people });
}

export async function POST(req: NextRequest) {
  try {
    const { name } = (await req.json()) as { name: string };
    const trimmed = (name || "").trim();
    if (!trimmed) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const id = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!id) {
      return NextResponse.json({ error: "invalid name" }, { status: 400 });
    }

    // Check for duplicate name (case-insensitive)
    const existing = await readPeople();
    if (existing.find((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return NextResponse.json(
        { error: "person already exists", people: existing },
        { status: 409 }
      );
    }

    // Handle id collision by appending a counter
    let finalId = id;
    let counter = 2;
    while (existing.find((p) => p.id === finalId)) {
      finalId = `${id}-${counter}`;
      counter++;
    }

    const people = await addPerson({ id: finalId, name: trimmed });
    return NextResponse.json({ people });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
