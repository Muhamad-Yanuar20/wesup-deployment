import type { NextResponse } from "next/server";
export class RequestTiming {
  readonly requestId: string;
  private readonly start = performance.now();
  private readonly phases: Array<{ name: string; ms: number }> = [];
  constructor(private readonly route: string, requestId = crypto.randomUUID()) { this.requestId = requestId; }
  async measure<T>(name: string, operation: () => PromiseLike<T>): Promise<T> {
    const start = performance.now();
    try { return await operation(); } finally { this.phases.push({ name, ms: performance.now() - start }); }
  }
  finish<T extends NextResponse>(response: T): T {
    const total = performance.now() - this.start;
    response.headers.set("Server-Timing", [...this.phases, { name: "total", ms: total }].map(p => `${p.name};dur=${p.ms.toFixed(1)}`).join(", "));
    response.headers.set("X-Request-ID", this.requestId);
    if (total > 1000) console.warn("[slow-request]", { route: this.route, requestId: this.requestId, totalMs: Math.round(total), phases: this.phases.map(p => ({ name: p.name, ms: Math.round(p.ms) })) });
    return response;
  }
}
