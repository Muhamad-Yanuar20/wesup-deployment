import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `Reveal` server-renders every landing section in the `data-reveal="hidden"`
 * state and only flips it from JavaScript. With scripting unavailable (or
 * hydration failed) nothing ever flips it, so the hidden state itself must be
 * gated behind the `scripting` media feature: browsers without scripting —
 * or without support for the query, which evaluates it as false — keep the
 * content visible. An invisible landing page is worse than an unanimated one.
 */
describe("landing reveal CSS contract", () => {
  const css = readFileSync(resolve(process.cwd(), "app", "globals.css"), "utf8");
  const HIDDEN_RULE = '.wesup-reveal[data-reveal="hidden"]';
  const SHOWN_RULE = '.wesup-reveal[data-reveal="shown"]';

  function mediaBlock(source: string, query: string): string | null {
    const start = source.indexOf(`@media ${query}`);
    if (start === -1) return null;
    const open = source.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) return source.slice(start, i + 1);
      }
    }
    return null;
  }

  it("declares the hidden state only inside @media (scripting: enabled)", () => {
    const block = mediaBlock(css, "(scripting: enabled)");
    expect(block, "expected a @media (scripting: enabled) block").not.toBeNull();
    expect(block).toContain(HIDDEN_RULE);

    const withoutBlock = css.replace(block as string, "");
    expect(withoutBlock).not.toContain(HIDDEN_RULE);
  });

  it("keeps the shown state unconditional so a revealed element never re-hides", () => {
    const block = mediaBlock(css, "(scripting: enabled)");
    expect(block).not.toBeNull();

    const withoutBlock = css.replace(block as string, "");
    expect(withoutBlock).toContain(SHOWN_RULE);
  });
});
