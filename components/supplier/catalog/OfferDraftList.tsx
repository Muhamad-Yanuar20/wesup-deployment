"use client";
import Link from "next/link";
import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { ContentSkeleton, ErrorState, AsyncButton } from "@/components/feedback";
type Draft = { id: string; step: number; payload: { title?: string } };
export default function OfferDraftList() {
 const { data, loading, error, reload } = useFeedbackResource<{ items: Draft[] }>("/api/suppliers/offers", "Draft belum dapat dimuat.");
 if (!data && loading) return <ContentSkeleton label="Memuat draft…" variant="form" />;
 if (!data && error) return <ErrorState title="Draft belum dapat dimuat." description={error} action={<AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton>} />;
 if (!data?.items?.length) return null;
 return <section className="mb-6 rounded-xl border bg-white p-5"><h2 className="font-semibold">Draft belum selesai</h2><ul className="mt-3 space-y-3">{data.items.map(d => <li key={d.id}><Link className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-slate-50 p-3" href={`/supplier/catalog/new?draft=${d.id}`}><span>{d.payload.title || "Penawaran tanpa nama"}</span><span className="text-xs font-semibold text-blue-700">Lanjut langkah {d.step} →</span></Link></li>)}</ul></section>;
}
