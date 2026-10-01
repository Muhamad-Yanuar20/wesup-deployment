"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/feedback";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div aria-busy="true" className="h-[520px]"><span role="status" className="sr-only">Menyiapkan peta…</span><Skeleton className="h-full w-full" /></div>,
});

export function LeafletDemoClient() {
  return <LeafletMap />;
}
