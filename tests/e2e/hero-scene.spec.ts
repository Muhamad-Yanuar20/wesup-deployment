import { test, expect, type Page } from "@playwright/test";

/*
 * Rendered-surface assertions for the landing hero scene.
 *
 * The component suite pins class names, the data-webgl gate and the geometry
 * hooks, but it cannot read the browser's viewport. This spec holds what only
 * a real browser can: the scene actually mounts under the strict-dynamic nonce
 * CSP, the readability wash's left edge sits at the viewport's left edge
 * (x = 0) at every width, the desktop wash is 52vw wide (full-bleed below the
 * 768px breakpoint), and the wash always fills the full viewport height.
 *
 * The wash's right edge is a gradient whose alpha reaches zero exactly at the
 * element's right edge, so its flushness cannot be graded by a pixel seam: the
 * live 3D scene legitimately paints bright content that crosses the 52vw
 * boundary (measured crossing rows at 1440px), and a fixed-column RGB strip
 * therefore reports values that move with the scene, not the wash. The
 * sub-pixel bounding-box assertions below are content-invariant and catch the
 * regressions a seam would (a clipped wash, a re-introduced max-width, a wrong
 * anchor) with far less noise. The geometry is the contract; this file is part
 * of `npm run test:e2e` so the contract cannot drift.
 */

function collectBrowserErrs(page: Page) {
  const csp = new Set<string>();
  const pageErrs = new Set<string>();
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && /Content Security Policy/i.test(text)) csp.add(text);
  });
  page.on("pageerror", (err) => pageErrs.add(String(err)));
  return () => ({ csp: [...csp], pageErrs: [...pageErrs] });
}

test.describe("landing hero scene (browser)", () => {
  test("mounts a live WebGL canvas under the nonce CSP with no violations", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = collectBrowserErrs(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/");
    await expect(page.locator("[data-scene-root]")).toHaveAttribute(
      "data-webgl",
      "on",
      { timeout: 60_000 },
    );
    await expect(page.getByTestId("hero-scene-canvas")).toBeVisible();

    const { csp, pageErrs } = errors();
    expect(csp).toEqual([]);
    expect(pageErrs).toEqual([]);
  });

  const VIEWPORTS = [
    { name: "desktop-xl", width: 2560, height: 1440, washVw: 0.52 },
    { name: "desktop", width: 1440, height: 900, washVw: 0.52 },
    { name: "breakpoint-above", width: 768, height: 1024, washVw: 0.52 },
    { name: "breakpoint-below", width: 767, height: 1024, washVw: 1 },
    { name: "mobile", width: 390, height: 844, washVw: 1 },
  ] as const;

  for (const vp of VIEWPORTS) {
    test(`keeps the wash flush with the viewport at ${vp.name} (${vp.width}px)`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await expect(page.locator("[data-scene-root]")).toHaveAttribute(
        "data-webgl",
        "on",
        { timeout: 60_000 },
      );

      const box = (await page.getByTestId("hero-scene-wash").boundingBox()) ?? null;
      expect(box).not.toBeNull();
      if (!box) return;

      expect(Math.abs(box.x)).toBeLessThan(1);
      expect(Math.abs(box.y)).toBeLessThan(1);
      const expectedWidth = vp.width * vp.washVw;
      expect(Math.abs(box.width - expectedWidth)).toBeLessThan(2);
      expect(Math.abs(box.height - vp.height)).toBeLessThan(2);
    });
  }
});