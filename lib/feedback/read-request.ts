import { READ_BUDGET_MS, ReadTimeoutError } from "@/lib/performance/read-budget";
interface ReadEntry { controller: AbortController; promise: Promise<Response>; subscribers: number; settled: boolean; }
const reads = new Map<string, ReadEntry>();
/** Only in-flight GETs are shared; results are never cached. Reset at auth boundaries. */
export function resetReadRequests() {
  for (const entry of reads.values()) entry.controller.abort(new DOMException("Account changed", "AbortError"));
  reads.clear();
}
export function fetchRead(url: string, options: { signal?: AbortSignal; cache?: RequestCache } = {}): Promise<Response> {
  const key = `${options.cache ?? "no-store"}:${url}`;
  if (options.signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  let entry = reads.get(key);
  if (!entry) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new ReadTimeoutError()), READ_BUDGET_MS);
    entry = { controller, subscribers: 0, settled: false, promise: Promise.resolve(null as unknown as Response) };
    const created = entry;
    let onAbort!: () => void;
    const aborted = new Promise<Response>((_, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener("abort", onAbort, { once: true });
    });
    const network = fetch(url, { cache: options.cache ?? "no-store", signal: controller.signal }).then(async response => {
      const body = await response.arrayBuffer();
      return new Response([204,205,304].includes(response.status) ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
    });
    created.promise = Promise.race([network, aborted]).catch(error => { throw controller.signal.aborted ? controller.signal.reason : error; }).finally(() => {
      controller.signal.removeEventListener("abort", onAbort);
      clearTimeout(timer); created.settled = true;
      if (reads.get(key) === created) reads.delete(key);
    });
    reads.set(key, created);
  }
  const current = entry;
  current.subscribers++;
  return new Promise((resolve, reject) => {
    let released = false;
    const release = () => {
      if (released) return; released = true; current.subscribers--;
      options.signal?.removeEventListener("abort", abort);
      // React StrictMode reattaches synchronously before this microtask.
      queueMicrotask(() => { if (!current.settled && current.subscribers === 0) { if (reads.get(key) === current) reads.delete(key); current.controller.abort(new DOMException("Aborted", "AbortError")); } });
    };
    const abort = () => { release(); reject(new DOMException("Aborted", "AbortError")); };
    options.signal?.addEventListener("abort", abort, { once: true });
    current.promise.then(response => { if (!released) { release(); resolve(response.clone()); } }, error => { if (!released) { release(); reject(error); } });
  });
}
