import { test, expect } from "@playwright/test";
import { build } from "vite";
import { resolve } from "node:path";

// Render the real component against the application's real CSS, without auth
// fixtures or transaction requests. CSP bypass is confined to the test context.
test.use({ bypassCSP: true });
for (const width of [1440, 390]) {
  test(`consent remains square and usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    const result = await build({
      configFile: false, logLevel: "silent",
      plugins: [{
        name: "consent-fixture",
        resolveId: id => id.endsWith("virtual:consent-fixture") ? "\0consent-fixture" : undefined,
        load: id => id === "\0consent-fixture" ? `import React from "react"; import {createRoot} from "react-dom/client"; import Consent from ${JSON.stringify(resolve(process.cwd(), "components/marketplace/LocationConsentCheckbox.tsx"))}; createRoot(document.getElementById("consent-fixture")).render(React.createElement(Consent,{onChange:()=>{}}));` : undefined,
      }],
      build: { write: false, minify: false, lib: { entry: "virtual:consent-fixture", formats: ["iife"], name: "ConsentFixture" } },
      define: { "process.env.NODE_ENV": '"production"' },
    });
    await page.evaluate(() => {
      const container = document.createElement("main");
      container.id = "consent-fixture";
      container.style.cssText = "max-width:840px;margin:24px auto;padding:16px";
      document.body.replaceChildren(container);
    });
    const output = Array.isArray(result) ? result[0].output : "output" in result ? result.output : [];
    const script = output.find(item => item.type === "chunk");
    if (!script || script.type !== "chunk") throw new Error("Consent fixture did not compile");
    await page.addScriptTag({ content: script.code });
    const checkbox = page.getByRole("checkbox", { name: "Saya menyetujui lokasi pengambilan" });
    await expect(checkbox).toBeVisible();
    const dimensions = await checkbox.boundingBox();
    expect(dimensions?.width).toBe(20);
    expect(dimensions?.height).toBe(20);
    await page.getByText("Persetujuan Lokasi Pengambilan", { exact: true }).click();
    await expect(checkbox).toBeChecked();
    await expect(page.getByText(/Disetujui:/)).toBeVisible();
    await checkbox.focus(); await page.keyboard.press("Space");
    await expect(checkbox).not.toBeChecked();
    await expect(checkbox).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#consent-fixture").screenshot({ path: testInfo.outputPath(`checkbox-${width}.png`) });
  });
}
