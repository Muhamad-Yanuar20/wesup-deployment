"use client";

import dynamic from "next/dynamic";
import type { BusinessLocationPickerProps } from "./BusinessLocationPicker";

const BusinessLocationPicker = dynamic(() => import("./BusinessLocationPicker"), {
  ssr: false,
  loading: () => <div className="flex h-72 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50/60 sm:h-80" role="status"><span className="text-sm font-medium text-blue-800">Menyiapkan peta interaktif…</span></div>,
});

export default function BusinessLocationPickerClient(props: BusinessLocationPickerProps) {
  return <BusinessLocationPicker {...props} />;
}
