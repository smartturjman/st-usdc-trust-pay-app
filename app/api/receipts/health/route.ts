import { NextResponse } from "next/server";
import { readReceiptsStrict } from "@/app/lib/receipts";

export async function GET() {
  try {
    const receipts = readReceiptsStrict();
    return NextResponse.json({
      ok: true,
      count: receipts.length,
    });
  } catch (error) {
    console.warn("[ReceiptsHealth] store corrupted", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
