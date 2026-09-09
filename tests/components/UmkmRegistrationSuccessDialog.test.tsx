// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UmkmRegistrationSuccessDialog from "@/components/auth/UmkmRegistrationSuccessDialog";
import { renderComponent as render } from "./test-utils";

describe("UmkmRegistrationSuccessDialog", () => {
  it("keeps focus inside the dialog and closes to the provided callback", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<UmkmRegistrationSuccessDialog open requiresEmailConfirmation loginHref="/login?role=umkm" onClose={onClose} />);

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(/cek email anda/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tutup" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and exposes login action", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<UmkmRegistrationSuccessDialog open={true} requiresEmailConfirmation={false} loginHref="/login?role=umkm" onClose={onClose} />);

    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login?role=umkm");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});