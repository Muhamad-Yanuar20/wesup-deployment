import { test, expect } from "@playwright/test";

test.describe("protected API documentation", () => {
  test("opens Swagger UI with configured Basic Auth and disables Try it out", async ({ browser }) => {
    const username = process.env.SWAGGER_USERNAME;
    const password = process.env.SWAGGER_PASSWORD;
    test.skip(!username || !password, "Set SWAGGER_USERNAME and SWAGGER_PASSWORD for the docs smoke test.");

    const context = await browser.newContext({ httpCredentials: { username: username!, password: password! } });
    const page = await context.newPage();
    await page.goto("/docs");
    await expect(page.getByText("Wesup API")).toBeVisible();
    await expect(page.locator("main.docs-dark-shell")).toBeVisible();
    await expect(page.locator("main.docs-dark-shell")).toHaveCSS(
      "background-color",
      "rgb(11, 18, 32)",
    );
    await expect(page.locator("[data-testid='swagger-ui-dark'] .swagger-ui")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBeTruthy();
    await expect(page.locator(".try-out__btn")).toHaveCount(0);
    await context.close();
  });
});
