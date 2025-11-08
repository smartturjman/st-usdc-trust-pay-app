import {
  Interface,
  JsonRpcProvider,
  formatUnits,
  getAddress,
} from "ethers";
import { buildArcScanTxUrl, normalizeTxHash } from "@/app/lib/explorer";
import type { Receipt } from "@/app/lib/receipts";
import { findService } from "@/app/config/services";

type VerificationContext = {
  provider: JsonRpcProvider;
  transferInterface: Interface;
  usdcAddress: string;
  merchantAddress: string;
  usdcDecimals: number;
};

const REQUIRED_ENV = [
  "ARC_RPC_URL",
  "USDC_ADDRESS",
  "MERCHANT_ADDRESS",
  "USDC_DECIMALS",
] as const;

let cachedContext: VerificationContext | null = null;

export function ensureChainVerificationContext(): VerificationContext {
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

  const transferInterface = new Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);

  cachedContext = {
    provider,
    transferInterface,
    usdcAddress,
    merchantAddress,
    usdcDecimals,
  };

  return cachedContext;
}

export type ReceiptOverrides = {
  serviceId?: string;
  serviceLabel?: string;
  partner?: string;
  network?: string;
  status?: Receipt["status"];
};

export type ChainReceiptSuccess = {
  ok: true;
  receipt: Receipt;
};

export type ChainReceiptFailure =
  | {
      ok: false;
      status: "pending";
      message: string;
    }
  | {
      ok: false;
      status: "failed";
      message: string;
    };

export async function resolveReceiptFromChain(
  txHash: string,
  overrides: ReceiptOverrides = {},
): Promise<ChainReceiptSuccess | ChainReceiptFailure> {
  const {
    provider,
    transferInterface,
    usdcAddress,
    merchantAddress,
    usdcDecimals,
  } = ensureChainVerificationContext();

  const trimmed = txHash.trim();
  const receipt = await provider.getTransactionReceipt(trimmed);
  if (!receipt) {
    return {
      ok: false,
      status: "pending",
      message: "Transaction not indexed yet. Try again in a few seconds.",
    };
  }

  if (receipt.status !== 1) {
    return {
      ok: false,
      status: "failed",
      message: "Transaction reverted on-chain.",
    };
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
    return {
      ok: false,
      status: "failed",
      message: "USDC transfer to the merchant wallet was not found in this transaction.",
    };
  }

  const amountUSDC = formatUnits(amountRaw, usdcDecimals);
  const receiptHashes = receipt as Partial<{
    transactionHash: string;
    hash: string;
    txHash: string;
  }>;
  const responseTxHash =
    receiptHashes.transactionHash ??
    receiptHashes.hash ??
    receiptHashes.txHash ??
    trimmed;
  const normalizedTxHash = normalizeTxHash(responseTxHash) ?? responseTxHash;

  const networkLabel = overrides.network ?? "Arc Testnet";
  const statusLabel = overrides.status ?? "Verified";
  const serviceId = overrides.serviceId ?? undefined;
  const service = serviceId ? findService(serviceId) : undefined;
  const resolvedServiceLabel =
    overrides.serviceLabel ??
    service?.serviceLabel ??
    service?.label ??
    "Legal Translation - MOFA";
  const partner =
    overrides.partner ??
    service?.partner ??
    "Turjman Group";

  const query = new URLSearchParams();
  if (serviceId) query.set("serviceId", serviceId);
  if (resolvedServiceLabel) query.set("serviceLabel", resolvedServiceLabel);
  if (partner) query.set("partner", partner);
  if (networkLabel) query.set("network", networkLabel);
  if (statusLabel) query.set("status", statusLabel);

  const pdfQuery = new URLSearchParams(query);
  pdfQuery.set("format", "pdf");

  const explorerUrl = buildArcScanTxUrl(normalizedTxHash);
  const pdfUrl = `/api/receipts/${encodeURIComponent(normalizedTxHash)}?${pdfQuery.toString()}`;

  const receiptRecord: Receipt = {
    tx: normalizedTxHash,
    service: resolvedServiceLabel,
    serviceId,
    serviceLabel: resolvedServiceLabel,
    partner,
    amountUSDC,
    network: networkLabel,
    status: statusLabel,
    explorerUrl,
    pdfUrl,
    partnerUSDC: undefined,
    platformUSDC: undefined,
    splitMode: undefined,
    trustScore: undefined,
    reason: undefined,
    createdAt: new Date().toISOString(),
  };

  return { ok: true, receipt: receiptRecord };
}
