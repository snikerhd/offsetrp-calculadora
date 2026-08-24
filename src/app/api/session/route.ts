import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({ authed: isAuthed(req) });
}
