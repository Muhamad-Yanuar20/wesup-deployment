// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetReadRequests } from "@/lib/feedback/read-request";
import { useFeedbackResource } from "@/lib/feedback/use-resource";
function Resource({ url = "/api/example" }: { url?: string }) {
 const { data, loading, error, reload } = useFeedbackResource<{ title: string }>(url, "Data belum dapat dimuat.");
 return <><button onClick={() => void reload()}>Perbarui</button>{data && <p>{data.title}</p>}{loading && <p>Memuat</p>}{error && <p role="alert">{error}</p>}</>;
}
afterEach(() => {resetReadRequests();vi.useRealTimers();vi.unstubAllGlobals();});
describe("GET feedback lifecycle", () => {
 it("keeps confirmed content when refresh fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response('{"title":"Pesanan terakhir"}')).mockRejectedValueOnce(new TypeError("Failed to fetch")));
  render(<Resource />); await screen.findByText("Pesanan terakhir");
  fireEvent.click(screen.getByRole("button", { name: "Perbarui" }));
  await screen.findByRole("alert"); expect(screen.getByText("Pesanan terakhir")).toBeInTheDocument();
 });
 it("ignores a late response after the resource changes", async () => {
  let release!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(new Promise(resolve => { release = resolve; })).mockResolvedValueOnce(new Response('{"title":"Baru"}')));
  const view = render(<Resource url="/old" />); await act(async () => {}); view.rerender(<Resource url="/new" />);
  await screen.findByText("Baru"); await act(async () => release(new Response('{"title":"Lama"}')));
  expect(screen.queryByText("Lama")).not.toBeInTheDocument();
 });
 it("does not announce an aborted request as an error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")));
  render(<Resource />); await act(async () => {}); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
 });
});

it("keeps the last content and offers recovery after a hanging refresh expires",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(new Response('{"title":"Data terakhir"}')).mockImplementationOnce(()=>new Promise(()=>{})));
 render(<Resource/>);await screen.findByText("Data terakhir");
 vi.useFakeTimers();
 await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Perbarui"}));await vi.advanceTimersByTimeAsync(8000);});
 expect(screen.getByText("Data terakhir")).toBeInTheDocument();
 expect(screen.getByRole("alert")).toHaveTextContent("Coba lagi");
 expect(screen.queryByText("Memuat")).not.toBeInTheDocument();expect(fetch).toHaveBeenCalledTimes(2);
});
