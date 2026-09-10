// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import RegistrationRoleChooser from "@/components/auth/RegistrationRoleChooser";
import { renderComponent as render } from "./test-utils";

describe("RegistrationRoleChooser", () => {
  it("explains the two account paths before a form is opened", () => {
    render(<RegistrationRoleChooser />);

    expect(screen.getByRole("heading", { name: /pilih jenis akun/i })).toBeInTheDocument();
    expect(screen.getByText("Akun langsung aktif", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Membutuhkan verifikasi Admin", { exact: true })).toBeInTheDocument();
  });

  it("provides semantic, keyboard-focusable links for UMKM and Supplier", () => {
    render(<RegistrationRoleChooser />);

    expect(screen.getByRole("link", { name: /daftar sebagai umkm/i })).toHaveAttribute(
      "href",
      "/register/umkm",
    );
    expect(screen.getByRole("link", { name: /daftar sebagai supplier/i })).toHaveAttribute(
      "href",
      "/supplier/register",
    );
    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toMatch(/focus-visible/);
    }
  });
});
