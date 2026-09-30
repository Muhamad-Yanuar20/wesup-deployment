import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The proxy (`proxy.ts`) attaches a `strict-dynamic` + nonce CSP to every
 * public document. Next.js only stamps nonces onto the script/style tags it
 * emits while rendering a page for an incoming request — a statically
 * prerendered page ships nonce-less tags and, because `strict-dynamic`
 * disables host allowlisting, is blocked by its own policy. The scene never
 * mounts as a result.
 *
 * Any page that must stay client-runnable therefore has to opt into
 * request-time rendering. This pins that opt-in on the only static public
 * route left after the fix (the landing page); a regression here silently
 * kills every client interaction on the page.
 */
describe("nonce-based CSP covers only request-rendered pages", () => {
  const readAppFile = (file: string): string =>
    readFileSync(resolve(process.cwd(), "app", file), "utf8");

  it("landing page opts into per-request rendering so the scene scripts are nonce-allowed", () => {
    const source = readAppFile("page.tsx");

    expect(source).toContain('from "next/server"');
    expect(source).toContain("await connection()");
  });
});