type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export function requestAddress(request: Request) {
  const cloudflareAddress = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareAddress) return cloudflareAddress;
  const forwardedAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedAddress || "unknown";
}

export function allowRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
