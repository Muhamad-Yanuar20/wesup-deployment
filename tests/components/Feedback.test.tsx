// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Alert, AsyncButton, Progress, SuccessState } from "@/components/feedback";
import { ToastProvider, useToast } from "@/components/ui/GlobalToast";

function ToastActions() {
  const { toast } = useToast();
  return <><button onClick={() => toast("Pertama", "success", 5000)}>Pertama</button><button onClick={() => toast("Kedua", "info", 5000)}>Kedua</button></>;
}

afterEach(() => vi.useRealTimers());
describe("feedback lifecycle", () => {
  it("does not restart an existing toast timer when another toast appears", () => {
    vi.useFakeTimers();
    render(<ToastProvider><ToastActions /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Pertama" }));
    act(() => vi.advanceTimersByTime(3000));
    fireEvent.click(screen.getByRole("button", { name: "Kedua" }));
    act(() => vi.advanceTimersByTime(2001));
    expect(screen.queryByText("Pertama", { selector: "p, span" })).not.toBeInTheDocument();
    expect(screen.getByText("Kedua", { selector: "p, span" })).toBeInTheDocument();
  });
  it("pauses toast expiry while the user reads it", () => {
    vi.useFakeTimers();
    render(<ToastProvider><ToastActions /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Pertama" }));
    const toast = screen.getByText("Pertama", { selector: "p, span" }).closest("article, [role=alert]")!;
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText("Pertama", { selector: "p, span" })).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(5001));
    expect(screen.queryByText("Pertama", { selector: "p, span" })).not.toBeInTheDocument();
  });
  it("announces routine status politely and errors assertively", () => {
    render(<><Alert tone="warning">Jadwal berubah.</Alert><Alert tone="error">Penyimpanan gagal.</Alert></>);
    expect(screen.getByRole("status")).toHaveTextContent("Jadwal berubah");
    expect(screen.getByRole("alert")).toHaveTextContent("Penyimpanan gagal");
  });
  it("uses a measured progress value and an accessible phase label", () => {
    render(<Progress value={2} max={5} label="Menyiapkan foto" />);
    expect(screen.getByRole("progressbar", { name: "Menyiapkan foto" })).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "5");
  });
  it("locks only the pending action and keeps its label readable", () => {
    render(<AsyncButton pending pendingLabel="Menyimpan rekening…">Simpan rekening</AsyncButton>);
    expect(screen.getByRole("button", { name: "Menyimpan rekening…" })).toBeDisabled();
  });
  it("shows a main success without a dialog", () => {
    render(<SuccessState title="Pendaftaran diterima" description="Masuk untuk memantau status." />);
    expect(screen.getByRole("status")).toHaveTextContent("Pendaftaran diterima");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
