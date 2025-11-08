import { NextResponse } from "next/server";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatUnits,
  isAddress,
  parseUnits,
} from "ethers";
import { DEFAULT_SPLIT, calcSplit } from "@/app/lib/split";
import { assertAllowed } from "@/app/lib/ratelimit";
import { addReceipt } from "@/app/lib/receipts";
import { getExplorerUrl } from "@/app/lib/explorer";

type PayRequestBody = {
  amountUSDC?: string;
  partnerId?: string;
  serviceId?: string;
  serviceLabel?: string;
};

type PaymentContext = {
  usdcContract: Contract;
  merchantAddress: string;
  usdcDecimals: number;
  signerAddress: string;
  explorerBase?: string;
};

function formatApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return typeof error === "string" ? error : JSON.stringify(error);
  } catch {
    return String(error);
  }
}

const REQUIRED_ENV = [
  "ARC_RPC_URL",
  "SERVICE_PRIVATE_KEY",
  "MERCHANT_ADDRESS",
  "USDC_ADDRESS",
  "USDC_DECIMALS",
] as const;

let cachedContext: PaymentContext | null = null;

function ensurePaymentContext(): PaymentContext {
  if (cachedContext) {
    return cachedContext;
  }

  const missingEnv = REQUIRED_ENV.filter(
    (key) => !(process.env[key] && process.env[key]!.length > 0),
  );
  if (missingEnv.length > 0) {
    throw new Error(
      `Missing environment variables: ${missingEnv.join(", ")}`,
    );
  }

  const rpcUrl = process.env.ARC_RPC_URL!;
  const chainId =
    process.env.ARC_CHAIN_ID && Number(process.env.ARC_CHAIN_ID) > 0
      ? Number(process.env.ARC_CHAIN_ID)
      : undefined;
  const explorerBase =
    process.env.ARC_EXPLORER_BASE ?? process.env.NEXT_PUBLIC_ARC_EXPLORER_BASE;

  const merchantAddress = process.env.MERCHANT_ADDRESS!;
  if (!isAddress(merchantAddress)) {
    throw new Error("MERCHANT_ADDRESS is not a valid address.");
  }

  const usdcAddress = process.env.USDC_ADDRESS!;
  if (!isAddress(usdcAddress)) {
    throw new Error("USDC_ADDRESS is not a valid address.");
  }

  const usdcDecimals = Number(process.env.USDC_DECIMALS);
  if (!Number.isInteger(usdcDecimals) || usdcDecimals < 0) {
    throw new Error("USDC_DECIMALS must be a non-negative integer.");
  }

  const provider = new JsonRpcProvider(rpcUrl, chainId);
  const signer = new Wallet(process.env.SERVICE_PRIVATE_KEY!, provider);
  const usdcContract = new Contract(
    usdcAddress,
    [
      "function transfer(address to, uint256 value) returns (bool)",
      "function balanceOf(address owner) view returns (uint256)",
    ],
    signer,
  );

  cachedContext = {
    usdcContract,
    merchantAddress,
    usdcDecimals,
    signerAddress: signer.address,
    explorerBase: explorerBase?.replace(/\/$/, ""),
  };

  return cachedContext;
}

export async function POST(request: Request) {
  let requestBody: PayRequestBody | null = null;

  try {
    await assertAllowed(request);
    const {
      usdcContract,
      merchantAddress,
      usdcDecimals,
      explorerBase,
      signerAddress,
    } =
      ensurePaymentContext();

    requestBody = (await request.json()) as PayRequestBody;
    if (!requestBody.amountUSDC) {
      return NextResponse.json(
        { error: "amountUSDC is required" },
        { status: 400 },
      );
    }

    const amountNumber = Number(requestBody.amountUSDC);
    if (!Number.isFinite(amountNumber)) {
      return NextResponse.json(
        { error: "amountUSDC must be numeric" },
        { status: 400 },
      );
    }

    const amount = parseUnits(requestBody.amountUSDC, usdcDecimals);
    const currentBalance = (await usdcContract.balanceOf(
      signerAddress,
    )) as bigint;

    if (currentBalance < amount) {
      return NextResponse.json(
        {
          error: "Insufficient tUSDC balance on signer",
          need: requestBody.amountUSDC,
          have: formatUnits(currentBalance, usdcDecimals),
        },
        { status: 400 },
      );
    }

    const { partnerUSDC, platformUSDC } = calcSplit(
      amountNumber,
      DEFAULT_SPLIT,
    );

    const txResponse = await usdcContract.transfer(merchantAddress, amount);
    await txResponse.wait();

    const txHash =
      txResponse?.hash ??
      txResponse?.txHash ??
      txResponse?.transactionHash ??
      null;
    const explorerUrl = getExplorerUrl(txHash) ?? (explorerBase && txHash ? `${explorerBase}/tx/${txHash}` : undefined);

    return NextResponse.json({
      success: true,
      txHash: txHash ?? undefined,
      explorerUrl,
      amountUSDC: amountNumber,
      partnerUSDC,
      platformUSDC,
      splitMode: "offchain-stub",
      serviceId: requestBody.serviceId ?? null,
      serviceLabel: requestBody.serviceLabel ?? null,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Too many requests") {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Payment failed";

    try {
      const fallbackAmount =
        typeof requestBody?.amountUSDC === "string" &&
        requestBody.amountUSDC.length > 0
          ? requestBody.amountUSDC
          : "0.00";
      await addReceipt({
        tx: "(none)",
        service: requestBody?.serviceLabel ?? undefined,
        serviceId: requestBody?.serviceId,
        serviceLabel: requestBody?.serviceLabel,
        partner: requestBody?.partnerId,
        amountUSDC: fallbackAmount,
        status: "Failed",
        reason: message,
        explorerUrl: "",
        pdfUrl: "",
        network: "Arc Testnet",
        createdAt: new Date().toISOString(),
      });
    } catch (logError) {
      console.warn(`[API] Failed to log fallback receipt: ${formatApiError(logError)}`);
    }

    return NextResponse.json(
      { error: "Payment failed", reason: message },
      { status: 500 },
    );
  }
}
