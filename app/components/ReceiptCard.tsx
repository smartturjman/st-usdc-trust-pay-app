"use client";

import Image from "next/image";
import { useState } from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type ReceiptCardData = {
  txHash?: string | null;
  serviceName?: string | null;
  service?: string | null;
  partner?: string | null;
  amount?: string | number | null;
  network?: string | null;
  status?: string | null;
  arcscanUrl?: string | null;
  explorerUrl?: string | null;
  qrUrl?: string | null;
  pdfUrl?: string | null;
};

type ReceiptCardProps = {
  data: ReceiptCardData;
};

const statusStyles: Record<
  "Verified" | "Pending" | "Failed",
  { bg: string; text: string; label: string }
> = {
  Verified: {
    bg: "bg-green-100",
    text: "text-green-700",
    label: "Verified",
  },
  Pending: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    label: "Pending",
  },
  Failed: {
    bg: "bg-red-100",
    text: "text-red-700",
    label: "Failed",
  },
};

function formatAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "number") {
    return `${value.toFixed(2)} USDC`;
  }
  return /usdc$/i.test(value) ? value : `${value} USDC`;
}

export default function ReceiptCard({ data }: ReceiptCardProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const txHash = data.txHash ?? "N/A";
  const shortHash =
    txHash.length > 20 ? `${txHash.slice(0, 12)}…${txHash.slice(-8)}` : txHash;
  const explorerHref = data.explorerUrl ?? data.arcscanUrl ?? undefined;
  const pdfHref =
    data.pdfUrl ?? (data.txHash ? `/api/receipts/${data.txHash}?format=pdf` : undefined);
  const receiptHref = data.txHash ? `/receipts/${data.txHash}` : undefined;
  const qrSrc = data.qrUrl
    ? data.qrUrl
    : explorerHref
      ? `https://quickchart.io/qr?text=${encodeURIComponent(explorerHref)}&size=240&margin=1`
      : null;
  const network = data.network ?? "Arc Testnet";
  const service =
    data.serviceName ?? data.service ?? "Legal Translation - MOFA";
  const status =
    data.status && data.status in statusStyles ? (data.status as "Verified" | "Pending" | "Failed") : "Verified";
  const statusStyle = statusStyles[status];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-slate-900">
        Verified Transaction Receipt
      </h2>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Transaction Hash
          </div>
          <div className="mt-1 font-mono text-xs text-slate-900 break-all" title={txHash}>
            {shortHash}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Service
          </div>
          <div className="mt-1 text-sm font-medium text-slate-900">{service}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Partner
          </div>
          <div className="mt-1 text-sm font-medium text-slate-900">{data.partner ?? "N/A"}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Amount
          </div>
          <div className="mt-1 text-sm font-medium text-slate-900">
            {formatAmount(data.amount)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Network
          </div>
          <div className="mt-1 text-sm font-medium text-slate-900">{network}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
            statusStyle.bg,
            statusStyle.text,
          )}
        >
          {statusStyle.label}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={explorerHref ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow",
            explorerHref
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "cursor-not-allowed bg-slate-200 text-slate-500",
          )}
          aria-disabled={!explorerHref}
        >
          View on ArcScan
        </a>
        <a
          href={pdfHref ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow",
            pdfHref
              ? "bg-gray-100 text-slate-800 hover:bg-gray-200"
              : "cursor-not-allowed bg-slate-200 text-slate-500",
          )}
          aria-disabled={!pdfHref}
        >
          Download PDF
        </a>
        <button
          type="button"
          onClick={async () => {
            if (!receiptHref) return;
            setCopyState("idle");
            const origin =
              typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
            const linkToCopy = origin ? `${origin}${receiptHref}` : receiptHref;
            try {
              const clipboard =
                typeof navigator !== "undefined" && navigator?.clipboard
                  ? navigator.clipboard
                  : null;
              if (!clipboard) {
                const helper = document.createElement("textarea");
                helper.value = linkToCopy;
                helper.setAttribute("readonly", "");
                helper.style.position = "absolute";
                helper.style.left = "-9999px";
                document.body.appendChild(helper);
                helper.select();
                document.execCommand("copy");
                document.body.removeChild(helper);
              } else {
                await clipboard.writeText(linkToCopy);
              }
              setCopyState("copied");
              setTimeout(() => setCopyState("idle"), 2500);
            } catch {
              setCopyState("error");
              setTimeout(() => setCopyState("idle"), 2500);
            }
          }}
          disabled={!receiptHref}
          className={cn(
            "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow",
            receiptHref
              ? "bg-white text-slate-800 hover:bg-slate-50 border border-slate-200"
              : "cursor-not-allowed bg-slate-200 text-slate-500",
          )}
        >
          {copyState === "copied"
            ? "Link copied"
            : copyState === "error"
              ? "Copy failed"
              : "Copy receipt link"}
        </button>
      </div>
      {receiptHref && (
        <div className="mt-1 text-xs text-slate-500">
          View later:{" "}
          <a
            href={receiptHref}
            className="underline text-indigo-600 hover:text-indigo-800"
            target="_blank"
            rel="noopener noreferrer"
          >
            {receiptHref}
          </a>
        </div>
      )}

      <div className="mt-6 flex flex-col items-center gap-3">
        {qrSrc ? (
          <>
            <Image
              src={qrSrc}
              alt="ArcScan QR code"
              width={240}
              height={240}
              className="h-60 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow"
            />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Scan to open on ArcScan
            </span>
          </>
        ) : (
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 text-center">
            ArcScan link unavailable
          </div>
        )}
      </div>
    </div>
  );
}
