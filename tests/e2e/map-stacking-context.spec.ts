import { test, expect } from "@playwright/test";

/**
 * Regression guard: a Leaflet map must never paint above page chrome.
 *
 * Leaflet paints its panes with z-index values up to 1000. When the map
 * wrapper does not create its own stacking context, those values escape into
 * the root stacking context and the map covers sticky navigation (z-40).
 *
 * The check injects a chrome probe (z-index 40) over the map and asks the
 * browser which element actually paints on top at that point. Before the fix
 * the Leaflet pane (z-index 1000) wins; after the fix the probe wins.
 */
test.describe("Leaflet map stacking context", () => {
  test("map panes stay below sticky page chrome", async ({ page }) => {
    await page.goto("/demo/leaflet");

    const map = page.locator(".leaflet-container").first();
    await expect(map).toBeVisible({ timeout: 30_000 });

    const probeVisible = await page.evaluate(() => {
      const container = document.querySelector(".leaflet-container");
      if (!container) return { ok: false as const, reason: "no map" };
      // The nearest ancestor that creates a stacking context contains every
      // Leaflet pane, so climb until we find it (the wrapper may be a card).
      let wrapper: HTMLElement | null = container.parentElement;
      while (wrapper && getComputedStyle(wrapper).isolation === "auto") {
        wrapper = wrapper.parentElement;
      }
      const isolation = wrapper ? getComputedStyle(wrapper).isolation : "none";
      const rect = container.getBoundingClientRect();
      const probe = document.createElement("div");
      probe.id = "stacking-probe";
      probe.style.position = "absolute";
      probe.style.zIndex = "40";
      probe.style.width = "160px";
      probe.style.height = "48px";
      probe.style.background = "rgb(230, 25, 25)";
      probe.style.left = `${rect.left + window.scrollX + 12}px`;
      probe.style.top = `${rect.top + window.scrollY + 12}px`;
      document.body.appendChild(probe);
      const top = document.elementFromPoint(rect.left + 24, rect.top + 24);
      return {
        ok: true as const,
        isolation,
        topId: top?.id ?? "",
        topClass: top?.className?.toString().slice(0, 120) ?? "",
      };
    });

    expect(probeVisible.ok).toBe(true);
    if (probeVisible.ok) {
      expect(probeVisible.isolation).toBe("isolate");
      expect(probeVisible.topId).toBe("stacking-probe");
    }

    await page.screenshot({
      path: "docs/testing/map-stacking-context/map-layering.png",
      fullPage: false,
      animations: "disabled",
    });
  });
});
