import { RequestTiming } from "@/lib/performance/server-timing";
import { withinReadBudget } from "@/lib/performance/read-budget";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { buildContentSecurityPolicy, generateNonce, shouldAllowMidtransCsp } from "@/lib/security/csp";
import { authorizeDocsRequest, isDocsPath } from "@/lib/docs/basic-auth";

export async function updateSession(
  request: NextRequest,
): Promise<NextResponse | undefined> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.",
    );
  }

  let refreshed = false;
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        refreshed = true;
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  await withinReadBudget(supabase.auth.getClaims());

  return refreshed ? supabaseResponse : undefined;
}

export default async function proxy(request: NextRequest) {
  if (isDocsPath(request.nextUrl.pathname)) {
    const denied = authorizeDocsRequest(request);
    if (denied) return denied;
  }

  const nonce = generateNonce();
  const allowMidtrans = shouldAllowMidtransCsp(request.nextUrl.pathname);
  const { policy } = buildContentSecurityPolicy(nonce, { allowMidtrans });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const requestWithCsp = new NextRequest(request.url, {
    method: request.method,
    headers: requestHeaders,
  });

  const timing = new RequestTiming("proxy");
  let refreshed: NextResponse | undefined;
  try { refreshed = await timing.measure("proxy_auth", () => updateSession(requestWithCsp)); }
  catch { /* Page/API guards remain authoritative; preserve cookies on transport failure. */ }
  const response = refreshed ?? NextResponse.next({ request: requestWithCsp });
  response.headers.set("Content-Security-Policy", policy);

  return timing.finish(response);
}

export const config = {
  matcher: [
    "/docs/:path*",
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
