import { NextResponse } from "next/server";
import { SERVICES } from "@/app/config/services";

export async function GET() {
  return NextResponse.json({
    ok: true,
    network: "Arc Testnet",
    usdcAddress: process.env.USDC_ADDRESS ?? "",
    services: SERVICES.length,
    demo: process.env.DEMO_MODE === "1",
  });
}
