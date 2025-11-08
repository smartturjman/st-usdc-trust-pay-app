import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";

export type Receipt = {
  tx: string;
  service?: string;
  serviceId?: string;
  serviceLabel?: string;
  partner?: string;
  partnerUSDC?: number | string;
  platformUSDC?: number | string;
  splitMode?: string;
  amountUSDC: string; // "75.00"
  network: "Arc Testnet" | string;
  status: "Verified" | "Failed" | "Pending";
  reason?: string;
  trustScore?: number;
  explorerUrl: string;
  pdfUrl: string;
  createdAt: string; // ISO
};

type ReceiptMap = Record<string, Receipt>;

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "receipts.json");
const TMP_PREFIX = "receipts.tmp";

let writeQueue: Promise<void> = Promise.resolve();

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "{}", "utf8");
}

function normalizeKey(tx: string): string {
  return tx.toLowerCase();
}

function toReceiptMap(raw: unknown): ReceiptMap {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const map: ReceiptMap = {};
    for (const entry of raw) {
      if (entry && typeof entry === "object" && typeof (entry as Receipt).tx === "string") {
        const key = normalizeKey((entry as Receipt).tx);
        map[key] = entry as Receipt;
      }
    }
    return map;
  }
  if (typeof raw === "object") {
    return raw as ReceiptMap;
  }
  throw new Error("Receipts store is malformed.");
}

function readReceiptsStrictInternal(): ReceiptMap {
  ensureFile();
  const raw = fs.readFileSync(FILE, "utf8");
  const parsed = JSON.parse(raw);
  return toReceiptMap(parsed);
}

export function readReceiptsStrict(): Receipt[] {
  return Object.values(readReceiptsStrictInternal());
}

export function listReceipts(): Receipt[] {
  try {
    return Object.values(readReceiptsStrictInternal());
  } catch (error) {
    console.warn("[Receipts] Failed to parse receipts.json", error);
    return [];
  }
}

function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task);
  writeQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function writeReceipts(mutator: (current: ReceiptMap) => ReceiptMap): Promise<ReceiptMap> {
  return enqueueWrite(async () => {
    const current = readReceiptsStrictInternal();
    const next = mutator(current);
    const tmpPath = path.join(
      DATA_DIR,
      `${TMP_PREFIX}.${Date.now()}.${Math.random().toString(16).slice(2)}.json`,
    );
    await fsp.writeFile(tmpPath, JSON.stringify(next, null, 2), "utf8");
    await fsp.rename(tmpPath, FILE);
    return next;
  });
}

export async function addReceipt(r: Receipt) {
  const normalizedTx =
    typeof r.tx === "string" && r.tx !== "(none)"
      ? normalizeKey(r.tx)
      : `(none)-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const record = { ...r, tx: normalizedTx };
  const next = await writeReceipts((current) => ({
    ...current,
    [normalizedTx]: record,
  }));
  const keys = Object.keys(next);
  const idx = keys.indexOf(normalizedTx);
  console.info("RECEIPT_SAVED", { txHash: normalizedTx, idx });
  return record;
}

export function findLatestReceiptByTx(tx: string): Receipt | null {
  const normalized = normalizeKey(tx);
  const map = readReceiptsStrictInternal();
  return map[normalized] ?? null;
}
