import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const DOCS_PREFIX = "/docs";

export function isDocsPath(pathname: string): boolean {
  return pathname === DOCS_PREFIX || pathname.startsWith(`${DOCS_PREFIX}/`);
}

function response(
  message: string,
  code: string,
  status: 401 | 503,
  challenge = false,
): NextResponse {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    Vary: "Authorization",
    "Content-Type": "application/json; charset=utf-8",
  });
  if (challenge) {
    headers.set("WWW-Authenticate", 'Basic realm="Wesup API Docs", charset="UTF-8"');
  }
  return NextResponse.json({ error: message, code }, { status, headers });
}

function equalSecret(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left, "utf8").digest();
  const rightHash = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftHash, rightHash);
}

function parseAuthorization(value: string | null): { username: string; password: string } | null {
  if (!value?.startsWith("Basic ")) return null;
  const encoded = value.slice("Basic ".length).trim();
  if (!encoded) return null;
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

/**
 * Returns a response when the request must be rejected and null when it is
 * authenticated. Credentials are read only on the server and are never
 * included in a response or log entry.
 */
export function authorizeDocsRequest(request: Request): NextResponse | null {
  const username = process.env.SWAGGER_USERNAME;
  const password = process.env.SWAGGER_PASSWORD;
  if (!username || !password) {
    return response(
      "Dokumentasi API belum dikonfigurasi.",
      "SWAGGER_AUTH_NOT_CONFIGURED",
      503,
    );
  }

  const credentials = parseAuthorization(request.headers.get("authorization"));
  if (
    !credentials ||
    !equalSecret(credentials.username, username) ||
    !equalSecret(credentials.password, password)
  ) {
    return response(
      "Autentikasi dokumentasi diperlukan.",
      "SWAGGER_AUTH_INVALID",
      401,
      true,
    );
  }

  return null;
}
