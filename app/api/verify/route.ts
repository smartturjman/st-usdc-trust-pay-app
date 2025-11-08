import { NextRequest, NextResponse } from "next/server";
import { assertAllowed } from "@/app/lib/ratelimit";
import { addReceipt } from "@/app/lib/receipts";
import { findService } from "@/app/config/services";
import {
  resolveReceiptFromChain,
  type ReceiptOverrides,
} from "@/app/lib/chainReceipt";

let trustScore = 84;
const verifiedTxs = new Set<string>();

export async function GET(req: NextRequest) {
  try {
    await assertAllowed(req);

    const txParam =
      req.nextUrl.searchParams.get("tx") ??
      req.nextUrl.searchParams.get("txHash") ??
      req.nextUrl.searchParams.get("transactionHash");
    if (!txParam) {
      return NextResponse.json(
        { status: "failed", message: "Missing tx parameter." },
        { status: 400 },
      );
    }

    const txHash = txParam.trim();
    if (!txHash) {
      return NextResponse.json(
        { status: "failed", message: "Missing tx parameter." },
        { status: 400 },
      );
    }

    const serviceLabel =
      req.nextUrl.searchParams.get("serviceLabel") ?? "Legal Translation - MOFA";
    const serviceIdParam = req.nextUrl.searchParams.get("serviceId");
    const serviceId = serviceIdParam ?? undefined;
    const statusLabel = req.nextUrl.searchParams.get("status") ?? "Verified";
    const networkLabel = req.nextUrl.searchParams.get("network") ?? "Arc Testnet";

    const service = serviceId ? findService(serviceId) : undefined;
    const partnerLabel = service?.partnerId ?? service?.label ?? null;
    const overrides: ReceiptOverrides = {
      serviceId,
      serviceLabel,
      partner: service?.partner ?? partnerLabel ?? undefined,
      network: networkLabel,
      status: statusLabel as "Verified" | "Pending" | "Failed",
    };

    const resolved = await resolveReceiptFromChain(txHash, overrides);
    if (!resolved.ok) {
      const statusCode = resolved.status === "pending" ? 202 : 400;
      return NextResponse.json(
        {
          status: resolved.status,
          message: resolved.message,
        },
        { status: statusCode },
      );
    }
    const receipt = resolved.receipt;

    const normalizedTxKey = receipt.tx.toLowerCase();
    if (!verifiedTxs.has(normalizedTxKey)) {
      trustScore += 1;
      verifiedTxs.add(normalizedTxKey);
    }

    try {
      await addReceipt({
        ...receipt,
      });
    } catch (logError) {
      console.warn("[verify] failed to persist receipt", logError);
    }

    const receiptQuery = new URLSearchParams();
    if (receipt.serviceId) receiptQuery.set("serviceId", receipt.serviceId);
    if (receipt.serviceLabel) receiptQuery.set("serviceLabel", receipt.serviceLabel);
    if (receipt.partner) receiptQuery.set("partner", receipt.partner);
    if (receipt.network) receiptQuery.set("network", receipt.network);
    if (receipt.status) receiptQuery.set("status", receipt.status);
    const receiptQueryString = receiptQuery.toString();
    const receiptUrl = `/receipts/${receipt.tx}${receiptQueryString ? `?${receiptQueryString}` : ""}`;

    return NextResponse.json({
      ok: true,
      status: "verified",
      service: receipt.serviceLabel ?? serviceLabel,
      amount: receipt.amountUSDC,
      network: receipt.network,
      trustScoreNew: trustScore,
      txHash: receipt.tx,
      receiptUrl,
      pdfUrl: receipt.pdfUrl,
      explorerUrl: receipt.explorerUrl,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Too many requests") {
      return NextResponse.json(
        { status: "failed", message: "Rate limit exceeded" },
        { status: 429 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Unexpected verification error.";
    return NextResponse.json(
      { status: "failed", message },
      { status: 500 },
    );
  }
}
