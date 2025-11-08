const CAPACITY = 20;
const REFILL_RATE_PER_SEC = 1;

type Bucket = {
  tokens: number;
  updated: number;
};

const buckets = new Map<string, Bucket>();

function extractClientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function assertAllowed(req: Request): Promise<void> {
  const key = extractClientKey(req);
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: CAPACITY, updated: now };
  const elapsed = (now - bucket.updated) / 1000;

  const refill = elapsed * REFILL_RATE_PER_SEC;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + refill);
  bucket.updated = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    return;
  }

  buckets.set(key, bucket);
  throw new Error("Too many requests");
}
