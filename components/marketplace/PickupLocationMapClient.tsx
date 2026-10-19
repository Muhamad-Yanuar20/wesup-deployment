"use client";

import dynamic from "next/dynamic";
import type { PickupLocationMapProps } from "./PickupLocationMap";

const PickupLocationMap = dynamic(() => import("./PickupLocationMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[260px] items-center justify-center border border-wesup-ink/15 bg-wesup-paper tabular-nums"
      role="status"
    >
      <div className="flex items-center gap-3 text-sm font-medium text-wesup-ink-sub tabular-nums">
        <span className="h-3 w-3 animate-pulse bg-wesup-ink" />
        Memuat peta lokasi…
      </div>
    </div>
  ),
});

export default function PickupLocationMapClient(props: PickupLocationMapProps) {
  return <PickupLocationMap {...props} />;
}
