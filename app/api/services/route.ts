import { NextResponse } from "next/server";
import { SERVICES } from "@/app/config/services";

export async function GET() {
  return NextResponse.json({
    items: SERVICES.map((service) => ({
      id: service.id,
      label: service.label,
      priceUSDC: service.priceUSDC,
      partnerId: service.partnerId,
    })),
  });
}
