import { readEnv } from "@/app/lib/env";

export const ARC_EXPLORER_BASE =
  readEnv("NEXT_PUBLIC_ARC_EXPLORER_BASE")?.replace(/\/$/, "") ||
  "https://testnet.arcscan.app";

export function normalizeTxHash(value?: string | null): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return null;
}

export const normalizeTx = normalizeTxHash;

export function buildArcScanTxUrl(tx: string): string {
  return `${ARC_EXPLORER_BASE}/tx/${tx}`;
}

export const buildArcscanTxUrl = buildArcScanTxUrl;

export function buildQrUrl(url: string, size = 240, margin = 1): string {
  const encoded = encodeURIComponent(url);
  return `https://quickchart.io/qr?text=${encoded}&size=${size}&margin=${margin}`;
}

export function getExplorerUrl(tx?: string | null): string | null {
  const normalized = normalizeTxHash(tx);
  if (!normalized) {
    return null;
  }
  return buildArcScanTxUrl(normalized);
}
