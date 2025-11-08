import { NextResponse } from "next/server";
import { assertAllowed } from "@/app/lib/ratelimit";
import {
  addReceipt,
  listReceipts,
  type Receipt,
} from "../../../lib/receipts";
import { findService } from "@/app/config/services";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function guardDemoOnly() {
  if (IS_PRODUCTION) {
    return NextResponse.json({ error: "not-available" }, { status: 404 });
  }
  return null;
}

function applyPartnerFallback(receipt: Receipt): Receipt {
  const service = receipt.serviceId ? findService(receipt.serviceId) : undefined;
  const partner =
    receipt.partner ??
    service?.partner ??
    "Turjman Group";
  return { ...receipt, partner };
}

export async function GET() {
  const blocked = guardDemoOnly();
  if (blocked) return blocked;
  const items = listReceipts().map(applyPartnerFallback);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const blocked = guardDemoOnly();
  if (blocked) return blocked;
  try {
    await assertAllowed(req);
    const body = (await req.json()) as Partial<Receipt>;

    const required = [
      "tx",
      "amountUSDC",
      "serviceLabel",
      "explorerUrl",
      "pdfUrl",
      "serviceId",
    ];
    for (const k of required) {
      if (!body[k as keyof Receipt]) {
        return NextResponse.json({ error: `Missing ${k}` }, { status: 400 });
      }
    }

    const service = body.serviceId ? findService(body.serviceId) : undefined;
    const partner =
      body.partner ??
      service?.partner ??
      "Turjman Group";

    const saved = await addReceipt({
      tx: body.tx!,
      amountUSDC: String(body.amountUSDC!),
      service: body.service ?? body.serviceLabel,
      serviceId: body.serviceId,
      serviceLabel: body.serviceLabel,
      partner,
      explorerUrl: body.explorerUrl!,
      pdfUrl: body.pdfUrl!,
      network: body.network || "Arc Testnet",
      status: (body.status as Receipt["status"]) ?? "Verified",
      trustScore: body.trustScore,
      partnerUSDC:
        typeof body.partnerUSDC === "number"
          ? body.partnerUSDC
          : body.partnerUSDC
            ? Number(body.partnerUSDC)
            : undefined,
      platformUSDC:
        typeof body.platformUSDC === "number"
          ? body.platformUSDC
          : body.platformUSDC
            ? Number(body.platformUSDC)
            : undefined,
      splitMode: body.splitMode ?? undefined,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(applyPartnerFallback(saved));
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Too many requests") {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Bad request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
