import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { serverEnv } from "@/lib/config/env";

export async function rateLimitApiRoute(request: Request, bucket: string) {
  if (!serverEnv.UPSTASH_REDIS_REST_URL || !serverEnv.UPSTASH_REDIS_REST_TOKEN) {
    if (process.env.NODE_ENV === "production") {
      return { success: false as const };
    }

    return { success: true as const };
  }

  const redis = new Redis({
    url: serverEnv.UPSTASH_REDIS_REST_URL,
    token: serverEnv.UPSTASH_REDIS_REST_TOKEN
  });

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m")
  });

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous";

  return ratelimit.limit(`${bucket}:${ip}`);
}
