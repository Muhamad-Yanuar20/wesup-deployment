export function fulfillmentReturnTo(value: string | null, batchId: string, currentPath: string): string {
  const fallback = "/supplier/pesanan";
  if (!value || value.length > 4096 || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    if (decodeURIComponent(value).includes("\\") || decodeURIComponent(value).startsWith("//")) return fallback;
    const url = new URL(value, "https://wesup.local");
    const allowed = ["/supplier", "/supplier/catalog", fallback, `/supplier/batch/${batchId}`, `/supplier/batch/${batchId}/orders`];
    if (url.origin !== "https://wesup.local" || !allowed.includes(url.pathname) || url.pathname === currentPath) return fallback;
    return `${url.pathname}${url.search}`;
  } catch { return fallback; }
}
export function fulfillmentHref(target: string, source: string) {
  const url = new URL(target, "https://wesup.local");
  if (url.origin !== "https://wesup.local") return target;
  const match = /^\/supplier\/batch\/([^/]+)\/(orders|pickup)$/.exec(url.pathname);
  if (!match) return target;
  try {
    const previous = new URL(source, "https://wesup.local");
    if (previous.pathname === url.pathname) {
      const preserved = fulfillmentReturnTo(source, match[1], "");
      if (preserved !== "/supplier/pesanan") return preserved;
    }
  } catch { /* Fall back to the validated origin below. */ }
  url.searchParams.set("returnTo", fulfillmentReturnTo(source, match[1], url.pathname));
  return `${url.pathname}${url.search}`;
}
export function fulfillmentBackLabel(target: string) {
  const path = target.split("?")[0];
  return path.endsWith("/orders") ? "Kembali ke manajemen pesanan" : path === "/supplier/catalog" ? "Kembali ke katalog" : path === "/supplier" ? "Kembali ke dashboard" : path === "/supplier/pesanan" ? "Kembali ke pesanan & pengambilan" : "Kembali ke detail batch";
}
