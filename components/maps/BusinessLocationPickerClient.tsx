"use client";

import dynamic from "next/dynamic";
import type { BusinessLocationPickerProps } from "./BusinessLocationPicker";

import { Skeleton } from "@/components/feedback";

const BusinessLocationPicker = dynamic(() => import("./BusinessLocationPicker"), {
  ssr: false,
  loading: () => <div aria-busy="true" className="h-72 sm:h-80"><span role="status" className="sr-only">Menyiapkan peta…</span><Skeleton className="h-full w-full" /></div>,
});

export default function BusinessLocationPickerClient(props: BusinessLocationPickerProps) {
  return <BusinessLocationPicker {...props} />;
}
