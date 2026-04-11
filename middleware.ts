import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { rateLimitApiRoute } from "@/lib/security/rate-limit";

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const result = await rateLimitApiRoute(request, "middleware");

  if (!result.success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"]
};
