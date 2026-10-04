import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://localhost:3000",
  "https://127.0.0.1:3000",
]);

function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // If neither header is present, allow (same-origin non-CORS requests, tests, etc.)
  if ((!origin || origin === "") && (!referer || referer === "")) {
    return true;
  }

  if (origin && origin !== "") {
    try {
      const o = new URL(origin);
      const url = new URL(req.url);
      if (o.origin === url.origin) return true;
      if (ALLOWED_ORIGINS.has(o.origin)) return true;
      return false;
    } catch {
      return false;
    }
  }

  if (referer && referer !== "") {
    try {
      const r = new URL(referer);
      const url = new URL(req.url);
      if (r.origin === url.origin) return true;
      if (ALLOWED_ORIGINS.has(r.origin)) return true;
      return false;
    } catch {
      return false;
    }
  }

  return true;
}

export function csfrRequireSameOrigin(req: Request): Response | null {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { error: "Invalid origin", code: "csrf_origin_mismatch" },
      { status: 403 },
    );
  }
  return null;
}
