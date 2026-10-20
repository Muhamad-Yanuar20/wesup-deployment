"use client";
import { useState } from "react";
import SupplierBatchDetailClient from "./SupplierBatchDetailClient";
export default function SupplierBatchProductDisclosure({ batchId }: { batchId: string }) {
  const [loaded, setLoaded] = useState(false);
  return <details onToggle={event => { if (event.currentTarget.open) setLoaded(true); }}><summary className="cursor-pointer  border bg-wesup-paper p-4 font-semibold">Detail produk dan pengaturan penawaran</summary>{loaded && <SupplierBatchDetailClient batchId={batchId} />}</details>;
}
