import ReceiptCard, {
  type ReceiptCardData,
} from "@/app/components/ReceiptCard";
import { normalizeTxHash } from "@/app/lib/explorer";
import { headers } from "next/headers";

type PageProps = {
  params: Promise<{ tx: string }>;
};

const SHOULD_FORCE_DEPLOY_BASE =
  process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

function envBase() {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (fromEnv && SHOULD_FORCE_DEPLOY_BASE) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

// MUST await headers() in Next 15
async function absoluteBaseFromHeaders() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0];
  return `${proto}://${host}`;
}

async function baseUrl() {
  // Prefer explicit env; otherwise derive from incoming request
  return envBase() || (await absoluteBaseFromHeaders());
}

export default async function ReceiptPage({ params }: PageProps) {
  const { tx } = await params; // params is a Promise
  const canonical = normalizeTxHash(tx);
  if (!canonical) {
    return (
      <div className="p-8 text-sm text-red-600">
        Invalid transaction hash. Please check the link and try again.
      </div>
    );
  }

  const base = await baseUrl();

  const fetchReceipt = (hash: string) =>
    fetch(`${base}/api/receipts/${hash}`, { cache: "no-store" });

  // Try once; if 404, trigger verify then retry
  let res = await fetchReceipt(canonical);
  if (res.status === 404) {
    await fetch(`${base}/api/verify?tx=${canonical}`, { cache: "no-store" }).catch(
      () => {},
    );
    res = await fetchReceipt(canonical);
  }

  if (!res.ok) {
    return (
      <div className="p-8 text-sm">
        Receipt unavailable. Please refresh or verify again.
      </div>
    );
  }

  const data = (await res.json()) as ReceiptCardData;
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <ReceiptCard data={data} />
    </div>
  );
}
