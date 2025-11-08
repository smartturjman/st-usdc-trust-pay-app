import { NextRequest, NextResponse } from "next/server";
import {
  Interface,
  JsonRpcProvider,
  formatUnits,
  getAddress,
} from "ethers";
import { assertAllowed } from "@/app/lib/ratelimit";
import { addReceipt } from "@/app/lib/receipts";
import { buildArcScanTxUrl, normalizeTxHash } from "@/app/lib/explorer";
import { findService } from "@/app/config/services";

type VerificationContext = {
  provider: JsonRpcProvider;
  transferInterface: Interface;
  usdcAddress: string;
  merchantAddress: string;
  usdcDecimals: number;
  explorerBase?: string;
};

const REQUIRED_ENV = [
  "ARC_RPC_URL",
  "USDC_ADDRESS",
  "MERCHANT_ADDRESS",
  "USDC_DECIMALS",
] as const;

let cachedContext: VerificationContext | null = null;

function ensureVerificationContext(): VerificationContext {
  if (cachedContext) {
    return cachedContext;
  }

  const missingEnv = REQUIRED_ENV.filter(
    (key) => !(process.env[key] && process.env[key]!.length > 0),
  );
  if (missingEnv.length > 0) {
    throw new Error(`Missing environment variables: ${missingEnv.join(", ")}`);
  }

  const rpcUrl = process.env.ARC_RPC_URL!;
  const chainId =
    process.env.ARC_CHAIN_ID && Number(process.env.ARC_CHAIN_ID) > 0
      ? Number(process.env.ARC_CHAIN_ID)
      : undefined;
  const provider = new JsonRpcProvider(rpcUrl, chainId);

  const usdcAddress = getAddress(process.env.USDC_ADDRESS!);
  const merchantAddress = getAddress(process.env.MERCHANT_ADDRESS!);
  const usdcDecimals = Number(process.env.USDC_DECIMALS);
  if (!Number.isInteger(usdcDecimals) || usdcDecimals < 0) {
    throw new Error("USDC_DECIMALS must be a non-negative integer.");
  }

  const explorerBase =
    (process.env.ARC_EXPLORER_BASE ?? process.env.NEXT_PUBLIC_ARC_EXPLORER_BASE)?.replace(
      /\/$/,
      "",
    );

  const transferInterface = new Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);

  cachedContext = {
    provider,
    transferInterface,
    usdcAddress,
    merchantAddress,
    usdcDecimals,
    explorerBase,
  };

  return cachedContext;
}

let trustScore = 84;
const verifiedTxs = new Set<string>();

export async function GET(req: NextRequest) {
  try {
    await assertAllowed(req);
    const { provider, transferInterface, usdcAddress, merchantAddress, usdcDecimals } =
      ensureVerificationContext();

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

    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return NextResponse.json(
        {
          status: "pending",
          message: "Transaction not indexed yet. Try again in a few seconds.",
        },
        { status: 202 },
      );
    }

    if (receipt.status !== 1) {
      return NextResponse.json({
        status: "failed",
        message: "Transaction reverted on-chain.",
      });
    }

    let amountRaw: bigint | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcAddress.toLowerCase()) {
        continue;
      }
      try {
        const parsed = transferInterface.parseLog(log);
        if (!parsed) continue;
        const toAddress = getAddress(parsed.args.to);
        if (toAddress === merchantAddress) {
          amountRaw = parsed.args.value as bigint;
          break;
        }
      } catch {
        // ignore non-transfer logs
      }
    }

    if (!amountRaw) {
      return NextResponse.json({
        status: "failed",
        message: "USDC transfer to the merchant wallet was not found in this transaction.",
      });
    }

    const amountUSDC = formatUnits(amountRaw, usdcDecimals);
    const normalizedTxKey = txHash.toLowerCase();
    if (!verifiedTxs.has(normalizedTxKey)) {
      trustScore += 1;
      verifiedTxs.add(normalizedTxKey);
    }

    const serviceLabel =
      req.nextUrl.searchParams.get("serviceLabel") ?? "Legal Translation - MOFA";
    const serviceIdParam = req.nextUrl.searchParams.get("serviceId");
    const serviceId = serviceIdParam ?? undefined;
    const statusLabel = req.nextUrl.searchParams.get("status") ?? "Verified";
    const networkLabel = req.nextUrl.searchParams.get("network") ?? "Arc Testnet";

    const receiptHashes = receipt as Partial<{
      transactionHash: string;
      hash: string;
      txHash: string;
    }>;
    const txHashFromReceipt =
      receiptHashes.transactionHash ??
      receiptHashes.hash ??
      receiptHashes.txHash ??
      txHash;
    const responseTxHash = txHashFromReceipt ?? txHash;
    const normalizedTxForReceipt =
      normalizeTxHash(responseTxHash) ?? responseTxHash;

    const pdfEndpoint = `/api/receipts/${encodeURIComponent(normalizedTxForReceipt)}?format=pdf`;
    const arcscanUrl = buildArcScanTxUrl(normalizedTxForReceipt);

    const service = serviceId ? findService(serviceId) : undefined;
    const partnerLabel = service?.partnerId ?? service?.label ?? null;

    try {
      await addReceipt({
        tx: normalizedTxForReceipt,
        service: serviceLabel,
        serviceId,
        serviceLabel,
        partner: service?.partner ?? partnerLabel ?? "Turjman Group",
        amountUSDC,
        partnerUSDC: undefined,
        platformUSDC: undefined,
        splitMode: undefined,
        network: networkLabel,
        status: statusLabel as "Verified" | "Pending" | "Failed",
        explorerUrl: arcscanUrl,
        pdfUrl: pdfEndpoint,
        createdAt: new Date().toISOString(),
      });
    } catch (logError) {
      console.warn("[verify] failed to persist receipt", logError);
    }

    return NextResponse.json({
      ok: true,
      status: "verified",
      service: serviceLabel,
      amount: amountUSDC,
      network: networkLabel,
      trustScoreNew: trustScore,
      txHash: normalizedTxForReceipt,
      receiptUrl: `/receipts/${normalizedTxForReceipt}`,
      pdfUrl: pdfEndpoint,
      explorerUrl: arcscanUrl,
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
