import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { user } } = await supabase.auth.getUser();

  const protectedPaths = ["/chat"];
  const isProtected = protectedPaths.some((p) => req.nextUrl.pathname.startsWith(p));

  if (isProtected && !user) {
    const url = new URL("/login", req.url);
    url.searchParams.set("redirectTo", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Keep refreshed auth cookies attached to this response. API handlers
  // independently verify the user rather than trusting an injected header.
  return res;
}

export const config = {
  matcher: ["/chat", "/api/((?!pay/waffo/webhook|qq/webhook|jobs/).*)"],
};
