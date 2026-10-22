// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { Footer } from "@/components/layout/Footer";
it("limits the Supplier footer to brand and description", () => {
  render(<Footer {...{ variant: "brand-only" as const }} />);
  const footer = screen.getByRole("contentinfo");
  expect(within(footer).getByText("Wesup")).toBeVisible();
  expect(within(footer).queryAllByRole("link")).toHaveLength(0);
  expect(footer).not.toHaveTextContent("INSEVENT");
});
