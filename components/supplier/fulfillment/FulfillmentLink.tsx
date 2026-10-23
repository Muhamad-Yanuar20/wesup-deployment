"use client";
import NextLink from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { fulfillmentBackLabel, fulfillmentHref, fulfillmentReturnTo } from "@/lib/supplier-fulfillment/navigation";

export default function FulfillmentLink({ href, ...props }: ComponentProps<typeof NextLink>) {
  const pathname = usePathname() ?? "";
  const search = useSearchParams() ?? new URLSearchParams();
  let source = `${pathname}${search.size ? `?${search}` : ""}`;
  if (pathname.endsWith("/pickup")) source = search.get("returnTo") ?? "/supplier/pesanan";
  return <NextLink {...props} href={typeof href === "string" ? fulfillmentHref(href, source) : href} />;
}
export function FulfillmentBackLink({ batchId, page }: { batchId: string; page: "orders" | "pickup" }) {
  const search = useSearchParams() ?? new URLSearchParams();
  const target = fulfillmentReturnTo(search.get("returnTo"), batchId, `/supplier/batch/${batchId}/${page}`);
  return <NextLink href={target} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-wesup-ink-sub hover:text-wesup-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">← {fulfillmentBackLabel(target)}</NextLink>;
}
