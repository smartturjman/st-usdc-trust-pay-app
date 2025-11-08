/**
 * Simple autonomous payment agent.
 * Polls the Next.js API, inspects trust score, and auto-pays high-trust services.
 */

type QuoteResponse = {
  partnerId: string;
  priceUSDC: string | number;
  trustScore?: number;
};

type ServiceResponse = {
  id: string;
  label: string;
  partnerId: string;
  priceUSDC: number;
};

const BASE_URL = process.env.AGENT_API_BASE ?? "http://localhost:3000";
const POLL_INTERVAL_MS = Number(process.env.AGENT_INTERVAL_MS ?? 15000);
const TRUST_THRESHOLD = Number(process.env.AGENT_TRUST_THRESHOLD ?? 80);
const RUN_ONCE = process.argv.includes("--once");

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return typeof error === "string" ? error : JSON.stringify(error);
  } catch {
    return String(error);
  }
}

let selectedService: ServiceResponse | null = null;

async function ensureService(): Promise<ServiceResponse | null> {
  if (selectedService) return selectedService;

  try {
    const res = await fetch(`${BASE_URL}/api/services`);
    if (!res.ok) {
      console.error(
        `[Agent] Failed to load services: ${res.status} ${res.statusText}`,
      );
      return null;
    }
    const json = (await res.json()) as { items?: ServiceResponse[] };
    const first = json.items?.[0];
    if (!first) {
      console.warn("[Agent] No services available; skipping run.");
      return null;
    }
    selectedService = first;
    console.log(`[Agent] Using service ${first.id} (${first.label})`);
    return first;
  } catch (error) {
    console.error(`[Agent] Service fetch error: ${formatError(error)}`);
    return null;
  }
}

async function runAgent(): Promise<void> {
  const service = await ensureService();
  if (!service) return;

  try {
    const quoteRes = await fetch(`${BASE_URL}/api/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: service.id,
      }),
    });
    if (!quoteRes.ok) {
      console.error(
        `[Agent] Quote failed: ${quoteRes.status} ${quoteRes.statusText}`,
      );
      return;
    }
    const quote = (await quoteRes.json()) as QuoteResponse;
    const trust = quote.trustScore ?? 0;
    const price =
      typeof quote.priceUSDC === "number"
        ? quote.priceUSDC.toFixed(2)
        : quote.priceUSDC;

    if (trust < TRUST_THRESHOLD) {
      console.log(
        `[Agent] Held payment; trust too low (${trust}/${TRUST_THRESHOLD}).`,
      );
      return;
    }

    const payRes = await fetch(`${BASE_URL}/api/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerId: quote.partnerId ?? service.partnerId,
        amountUSDC: price,
        serviceId: service.id,
        serviceLabel: service.label,
      }),
    });

    if (!payRes.ok) {
      const errPayload = await payRes.json().catch(() => ({}));
      const payload =
        typeof errPayload === "object" ? JSON.stringify(errPayload) : String(errPayload);
      console.error(
        `[Agent] Payment failed: ${payRes.status} ${payRes.statusText} payload=${payload}`,
      );
      return;
    }

    const payData = await payRes.json();
    if (payData?.txHash) {
      console.log("✅ Payment successful, txHash:", payData.txHash);
    }
    console.log(
      `[Agent] Auto-paid ${service.label} (trust ${trust}). tx=${payData.txHash}`,
    );
  } catch (error) {
    console.error(`[Agent] Unexpected error: ${formatError(error)}`);
  }
}

console.log(
  RUN_ONCE
    ? `[Agent] Starting single-run mode (threshold ${TRUST_THRESHOLD}).`
    : `[Agent] Starting autonomous loop (interval ${POLL_INTERVAL_MS} ms, threshold ${TRUST_THRESHOLD}).`,
);

if (RUN_ONCE) {
  void runAgent().finally(() => {
    console.log("[Agent] Single run complete; exiting.");
    process.exit(0);
  });
} else {
  void runAgent();
  setInterval(runAgent, POLL_INTERVAL_MS);
}
