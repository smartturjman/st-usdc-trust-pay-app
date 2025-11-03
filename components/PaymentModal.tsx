"use client";
import { useState } from "react";

type Quote = { partnerId: string; priceUSDC: string; trustScore: number };

export default function PaymentModal() {
  const [open, setOpen] = useState(false);                 // ✅ added
  const [quote, setQuote] = useState<Quote | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [verify, setVerify] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function getQuote() {
    setLoading(true);
    const r = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: "legal-translation-mofa",
        docType: "birth-certificate",
      }),
    });
    const q = await r.json();
    setQuote(q);
    setLoading(false);
  }

  async function pay() {
    if (!quote) return;
    setLoading(true);
    // mock payment → generate a fake tx hash and store it
    const fake = "0xb7651d1f3198e" + "0".repeat(60);
    setTxHash(fake);
    setLoading(false);
  }

  async function doVerify() {
    if (!txHash) return;
    setLoading(true);
    const res = await fetch(`/api/verify?tx=${encodeURIComponent(txHash)}`);
    const data = await res.json();
    setVerify(data);
    setLoading(false);
  }

  return (
    <>
      <button
        className="px-5 py-3 rounded-2xl bg-indigo-600 text-white shadow"
        onClick={() => {
          setOpen(true);
          getQuote();
        }}
      >
        Pay Legal Translation (USDC)
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4">
            <div className="text-xl font-semibold">Legal Translation – MOFA</div>

            {loading && <div>Processing…</div>}

            {quote && (
              <div className="space-y-1 text-sm">
                <div><b>Partner:</b> {quote.partnerId}</div>
                <div><b>Price:</b> {quote.priceUSDC} USDC (gasless)</div>
                <div><b>Trust Score:</b> {quote.trustScore}/100</div>
              </div>
            )}

            {!txHash && (
              <button
                onClick={pay}
                className="w-full py-2 rounded-xl bg-emerald-600 text-white"
                disabled={loading || !quote}
              >
                Confirm USDC Payment
              </button>
            )}

            {txHash && !verify && (
              <>
                <div className="text-sm break-all">
                  <b>Tx Hash:</b> {txHash}
                </div>
                <button
                  onClick={doVerify}
                  disabled={loading}
                  className="w-full py-2 rounded-xl bg-indigo-700 text-white"
                >
                  Verify & Issue Receipt
                </button>
              </>
            )}

            {verify && (
              <div className="space-y-2">
                <div><b>Payment Verified</b> ✅</div>
                <div><b>New Trust Score:</b> {verify.trustScoreNew}</div>
                <a
                  href={verify.receiptUrl}   /* use API’s receiptUrl */
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-indigo-700"
                >
                  Download Verified Transaction Certificate (PDF)
                </a>
              </div>
            )}

            <button
              className="w-full py-2 rounded-xl bg-gray-100"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
