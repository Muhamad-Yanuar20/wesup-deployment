// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import LocationConsentCheckbox from "@/components/marketplace/LocationConsentCheckbox";

it("associates the complete consent text with the checkbox and toggles once", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<LocationConsentCheckbox onChange={onChange} />);
  const checkbox = screen.getByLabelText(/Persetujuan Lokasi Pengambilan/);
  await user.click(screen.getByText("Persetujuan Lokasi Pengambilan"));
  expect(checkbox).toBeChecked();
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenLastCalledWith(true, expect.any(Date));
  expect(screen.getByText(/Disetujui:/)).toBeVisible();
  await user.click(screen.getByText(/Saya menyetujui dan memahami/));
  expect(checkbox).not.toBeChecked();
  expect(onChange).toHaveBeenCalledTimes(2);
  expect(onChange).toHaveBeenLastCalledWith(false, null);
  expect(screen.queryByText(/Disetujui:/)).not.toBeInTheDocument();
});

it("supports toggling with Space while retaining keyboard focus", async () => {
  const user = userEvent.setup();
  render(<LocationConsentCheckbox onChange={vi.fn()} />);
  const checkbox = screen.getByRole("checkbox", { name: "Saya menyetujui lokasi pengambilan" });
  await user.tab();
  expect(checkbox).toHaveFocus();
  await user.keyboard(" ");
  expect(checkbox).toBeChecked();
  await user.keyboard(" ");
  expect(checkbox).not.toBeChecked();
  expect(checkbox).toHaveFocus();
});
