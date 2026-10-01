import { describe, expect, it } from "vitest";
import { feedbackError, readFeedbackError } from "@/lib/feedback/errors";

describe("user-facing request failures", () => {
  it.each(["Failed to fetch", "HTTP Error: 500", "Internal Server Error", "relation public.profiles does not exist"])("hides technical error %s", message => {
    expect(feedbackError(new Error(message), "Pesanan belum dapat dimuat.")).toBe("Pesanan belum dapat dimuat.");
  });
  it("preserves actionable Indonesian domain messages", () => {
    expect(feedbackError(new Error("Kapasitas penawaran sudah penuh."), "Coba lagi.")).toBe("Kapasitas penawaran sudah penuh.");
  });
  it("distinguishes an expired session from a resource restriction", async () => {
    const expired = await readFeedbackError(new Response("{}", { status: 401 }), "Coba lagi.");
    const blocked = await readFeedbackError(new Response(JSON.stringify({ error: "Batas ikut sudah berakhir." }), { status: 403 }), "Coba lagi.");
    expect(expired.message).toMatch(/Sesi Anda berakhir/);
    expect(blocked.message).toBe("Batas ikut sudah berakhir.");
  });
  it("retains a help reference while hiding database messages", async () => {
    const error = await readFeedbackError(new Response(JSON.stringify({ error: "permission denied for table batches", requestId: "fixture-reference" }), { status: 500 }), "Katalog belum dapat dimuat.");
    expect(error.message).toBe("Katalog belum dapat dimuat.");
    expect(error.requestId).toBe("fixture-reference");
  });
});
