"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  SERVICES,
  findService,
  type ServiceItem,
} from "@/app/config/services";
import { getExplorerUrl, normalizeTx, normalizeTxHash } from "@/app/lib/explorer";

type Quote = { partnerId: string; priceUSDC: string; trustScore: number };
type PayResponse = {
  txHash?: string;
  explorerUrl?: string;
  error?: string;
  details?: string;
  need?: string;
  have?: string;
  amountUSDC?: number;
  partnerUSDC?: number;
  platformUSDC?: number;
  splitMode?: string;
  serviceId?: string | null;
  serviceLabel?: string | null;
};
type VerificationResponse = {
  ok?: boolean;
  status?: string;
  trustScoreNew?: number;
  receiptUrl?: string;
  pdfUrl?: string;
  amount?: string;
  explorerUrl?: string;
  txHash?: string;
  tx?: string;
  message?: string;
  error?: string;
};

function serviceToQuote(service?: ServiceItem | null): Quote | null {
  if (!service) return null;
  return {
    partnerId: service.partnerId,
    priceUSDC: service.priceUSDC.toFixed(2),
    trustScore: service.defaultTrustScore ?? 84,
  };
}

const IS_DEV = process.env.NODE_ENV !== "production";

const logError = (...args: Parameters<typeof console.error>) => {
  if (IS_DEV) {
    console.error(...args);
  }
};

const logWarn = (...args: Parameters<typeof console.warn>) => {
  if (IS_DEV) {
    console.warn(...args);
  }
};

export default function PaymentModal() {
  const router = useRouter();
  const defaultService = SERVICES[0];
  const [open, setOpen] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serviceId, setServiceId] = useState<string>(
    defaultService?.id ?? "",
  );
  const [quote, setQuote] = useState<Quote | null>(
    serviceToQuote(defaultService),
  );
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState("");
  const [verifyResult, setVerifyResult] =
    useState<VerificationResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);
  const [verifiedTx, setVerifiedTx] = useState<string | null>(null);
  const [splitInfo, setSplitInfo] = useState<{
    partnerUSDC: number;
    platformUSDC: number;
    splitMode?: string;
  } | null>(null);

  const rememberTxHash = (hash: string): string => {
    const normalized = normalizeTx(hash) ?? hash;
    setTxHash(normalized);
    return normalized;
  };

  const selectedService = useMemo(
    () => findService(serviceId) ?? defaultService,
    [serviceId, defaultService],
  );

  const amountPlain =
    selectedService?.priceUSDC.toFixed(2) ??
    quote?.priceUSDC ??
    "0.00";

  const normalizedTx = normalizeTxHash(txHash);
  const canonicalTx = normalizedTx ?? (txHash.length > 0 ? txHash : null);
  const explorerLink =
    (verifiedTx ? getExplorerUrl(verifiedTx) ?? undefined : undefined) ??
    verifyResult?.explorerUrl ??
    (canonicalTx ? getExplorerUrl(canonicalTx) ?? undefined : undefined);
  const receiptPageUrl = verifiedTx
    ? `/receipts/${verifiedTx}`
    : canonicalTx
      ? `/receipts/${canonicalTx}`
      : null;
  const pdfHref = verifiedTx
    ? `/api/receipts/${verifiedTx}?format=pdf`
    : canonicalTx
      ? `/api/receipts/${canonicalTx}?format=pdf`
      : null;

  const resetFlow = () => {
    setTxHash("");
    setVerifyResult(null);
    setLogged(false);
    setActionError(null);
    setQuoteError(null);
    setSplitInfo(null);
    setVerifiedTx(null);
  };

  const applyServiceToQuote = (service?: ServiceItem | null) => {
    setQuote(serviceToQuote(service ?? selectedService));
    setSplitInfo(null);
  };

  const handleServiceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value;
    setServiceId(nextId);
    const service = findService(nextId) ?? defaultService;
    applyServiceToQuote(service);
    resetFlow();
  };

  async function pay() {
    if (!quote || !selectedService) return;
    setLoading(true);
    setActionError(null);
    setVerifyResult(null);
    setLogged(false);

    try {
      const response = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: quote.partnerId,
          amountUSDC: amountPlain,
          serviceId: selectedService.id,
          serviceLabel: selectedService.label,
        }),
      });
      const payload = (await response.json()) as PayResponse;
      const tx = payload.txHash;
      if (!response.ok || !tx) {
        logError("[PaymentModal] pay failed", {
          status: response.status,
          statusText: response.statusText,
          payload,
        });
        let message =
          payload.details ??
          payload.error ??
          "Payment failed to submit. Please retry.";
        if (
          response.status === 400 &&
          typeof payload.need === "string" &&
          typeof payload.have === "string"
        ) {
          message = `${message} (need ${payload.need}, have ${payload.have})`;
        }
        throw new Error(message);
      }
      rememberTxHash(tx);
      if (
        typeof payload.partnerUSDC === "number" &&
        typeof payload.platformUSDC === "number"
      ) {
        setSplitInfo({
          partnerUSDC: payload.partnerUSDC,
          platformUSDC: payload.platformUSDC,
          splitMode: payload.splitMode ?? "offchain-stub",
        });
      } else {
        setSplitInfo(null);
      }
    } catch (error) {
      logError("[PaymentModal] pay request error", error);
      const message =
        error instanceof Error
          ? error.message
          : "Payment failed. Please retry.";
      setActionError(message);
      setSplitInfo(null);
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (!txHash || !selectedService) return;
    setLoading(true);
    setActionError(null);
    setLogged(false);

    try {
      const verifyParams = new URLSearchParams({
        tx: txHash,
        serviceId: selectedService.id,
        serviceLabel: selectedService.label,
      });
      const response = await fetch(`/api/verify?${verifyParams.toString()}`);
      const payload = (await response.json()) as VerificationResponse;

      if (!response.ok || payload.ok === false || payload.status === "failed") {
        logError("[PaymentModal] verify failed", {
          status: response.status,
          statusText: response.statusText,
          payload,
        });
        const message =
          payload.message ??
          payload.error ??
          "Verification could not be completed. Try again shortly.";
        throw new Error(message);
      }

      setVerifyResult(payload);
      const txFromPayload =
        payload.txHash && payload.txHash.length > 0
          ? payload.txHash
          : payload.tx && payload.tx.length > 0
            ? payload.tx
            : null;
      const canonicalTxHash = normalizeTxHash(txFromPayload ?? txHash);
      if (!canonicalTxHash) {
        logError("Verify returned no tx hash:", payload);
        setActionError("Verification failed: missing transaction hash.");
        return;
      }
      rememberTxHash(canonicalTxHash);
      setVerifiedTx(canonicalTxHash);

      const explorerUrl =
        payload.explorerUrl ?? getExplorerUrl(canonicalTxHash) ?? undefined;
      const partnerName = selectedService.partner ?? "Turjman Group";
      const networkLabel = "Arc Testnet";
      const receiptQuery = new URLSearchParams({
        serviceId: selectedService.id,
        serviceLabel: selectedService.label,
        partner: partnerName,
        network: networkLabel,
        status: "Verified",
      });
      const queryString = receiptQuery.toString();
      const pdfUrlWithMeta = `/api/receipts/${canonicalTxHash}?format=pdf${
        queryString ? `&${queryString}` : ""
      }`;
      const receiptPath = `/receipts/${canonicalTxHash}${
        queryString ? `?${queryString}` : ""
      }`;
      const pdfUrl = payload.pdfUrl ?? pdfUrlWithMeta;
      const amountLogged =
        (typeof payload.amount === "string" && payload.amount.length > 0
          ? payload.amount
          : amountPlain);

      try {
        const res = await fetch("/api/receipts/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tx: canonicalTxHash,
              amountUSDC: amountLogged,
              service: selectedService.label,
              serviceId: selectedService.id,
              serviceLabel: selectedService.label,
              partner: partnerName,
              network: networkLabel,
              status: "Verified",
              explorerUrl,
              pdfUrl,
              partnerUSDC: splitInfo?.partnerUSDC,
              platformUSDC: splitInfo?.platformUSDC,
              splitMode: splitInfo?.splitMode ?? "offchain-stub",
            }),
        });
        if (res.ok) {
          setLogged(true);
        } else {
          logWarn(
            "Failed to log receipt",
            await res.text().catch(() => "unknown error"),
          );
        }
      } catch (logError) {
        logWarn("Unable to log receipt", logError);
      }

      setOpen(false);
      setSelectOpen(false);
      router.push(receiptPath);
    } catch (error) {
      logError("[PaymentModal] verify request error", error);
      const message =
        error instanceof Error
          ? error.message
          : "Verification failed. Please try again.";
      setActionError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="px-5 py-3 rounded-2xl bg-indigo-600 text-white shadow"
        onClick={() => {
          setSelectOpen(true);
        }}
      >
        Pay Smart Turjman Services
      </button>

      {selectOpen && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xl font-semibold">Select a service</div>
              <button
                className="text-sm text-slate-500 hover:text-slate-700"
                onClick={() => setSelectOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {SERVICES.map((service) => (
                <button
                  key={service.id}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-indigo-400 transition"
                  onClick={() => {
                    setServiceId(service.id);
                    applyServiceToQuote(service);
                    resetFlow();
                    setSelectOpen(false);
                    setOpen(true);
                  }}
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {service.label}
                  </div>
                  <div className="text-xs text-slate-500">
                    Partner: {service.partnerId} • Trust: {service.defaultTrustScore ?? 0}/100
                  </div>
                  <div className="text-xs text-slate-500">
                    Price: {service.priceUSDC.toFixed(2)} USDC
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4">
            <div className="text-xl font-semibold">
              {selectedService?.label ?? "Select a service"}
            </div>

            <div className="space-y-1 text-sm">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Service
              </label>
              <select
                value={serviceId}
                onChange={handleServiceChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {SERVICES.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.label}
                  </option>
                ))}
              </select>
            </div>

            {loading && <div>Processing…</div>}

            {quoteError && (
              <div className="text-sm text-red-600">{quoteError}</div>
            )}

            {actionError && (
              <div className="text-sm text-red-600">{actionError}</div>
            )}

            {quote && (
              <div className="space-y-1 text-sm">
                <div>
                  <b>Service:</b> {selectedService?.label}
                </div>
                <div>
                  <b>Partner:</b> {quote.partnerId}
                </div>
                <div>
                  <b>Price:</b> {quote.priceUSDC} USDC (gasless)
                </div>
                <div>
                  <b>Trust Score:</b> {quote.trustScore}/100
                </div>
              </div>
            )}

            {!txHash && (
              <button
                onClick={() => void pay()}
                className="w-full py-2 rounded-xl bg-emerald-600 text-white"
                disabled={loading || !quote}
              >
                Confirm USDC Payment
              </button>
            )}

            {txHash && !verifyResult && (
              <>
                <div className="text-sm break-all">
                  <b>Tx Hash:</b>{" "}
                  {explorerLink ? (
                    <a
                      href={explorerLink}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-indigo-600 hover:text-indigo-800"
                    >
                      {txHash}
                    </a>
                  ) : (
                    txHash
                  )}
                </div>

                <button
                  onClick={() => void verify()}
                  disabled={loading}
                  className="w-full py-2 rounded-xl bg-indigo-700 text-white"
                >
                  Verify & Issue Receipt
                </button>
              </>
            )}

            {verifyResult && (
              verifiedTx ? (
                <div className="space-y-2">
                  <div>
                    <b>Payment Verified</b> ✅
                  </div>
                  {typeof verifyResult.trustScoreNew === "number" && (
                    <div>
                      <b>New Trust Score:</b> {verifyResult.trustScoreNew}
                    </div>
                  )}
                  {pdfHref && (
                    <div className="flex flex-col gap-1 text-sm">
                      <a
                        href={pdfHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-indigo-600 hover:text-indigo-700"
                      >
                        Download Verified Transaction Certificate (PDF)
                      </a>
                    </div>
                  )}
                  {receiptPageUrl && (
                    <a
                      href={receiptPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline text-indigo-600 hover:text-indigo-700"
                    >
                      Open receipt page
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-600">
                  Verified, but missing receipt hash. Please try Verify again.
                </p>
              )
            )}

            {logged && (
              <div className="text-xs text-gray-500">Saved to receipts log</div>
            )}

            <button
              className="w-full py-2 rounded-xl bg-gray-100"
              onClick={() => {
                setOpen(false);
                setLoading(false);
                setQuoteError(null);
                setActionError(null);
                setTxHash("");
                setVerifyResult(null);
                setLogged(false);
                applyServiceToQuote(selectedService);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
