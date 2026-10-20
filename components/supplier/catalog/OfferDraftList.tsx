"use client";
import Link from "next/link";
import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { ContentSkeleton, ErrorState, AsyncButton } from "@/components/feedback";
type Draft = { id: string; step: number; payload: { title?: string } };
export default function OfferDraftList() {
  const { data, loading, error, reload } = useFeedbackResource<{ items: Draft[] }>("/api/suppliers/offers", "Draft belum dapat dimuat.");
  if (!data && loading) return <ContentSkeleton label="Memuat draft…" variant="form" />;
  if (!data && error)
    return (
      <ErrorState
        title="Draft belum dapat dimuat."
        description={error}
        action={<AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton>}
      />
    );
  if (!data?.items?.length) return null;
  return (
    <section aria-label="Draft penawaran belum selesai" className="mb-6 border border-wesup-ink/15 bg-wesup-paper p-4 sm:p-5">
      <h2 className="font-landing-display text-xl font-normal uppercase tracking-[0.04em] text-wesup-ink">
        Draft belum selesai
      </h2>
      <ul className="mt-4 border-t border-wesup-ink/10">
        {data.items.map((d) => (
          <li key={d.id} className="border-b border-wesup-ink/10">
            <Link
              className="group flex min-h-11 items-center justify-between gap-3 px-3 py-3 transition-colors duration-300 wesup-ease hover:bg-wesup-paper-sub focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-wesup-red"
              href={`/supplier/catalog/new?draft=${d.id}`}
            >
              <span className="min-w-0 truncate text-sm font-semibold text-wesup-ink">{d.payload.title || "Penawaran tanpa nama"}</span>
              <span className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink underline decoration-transparent underline-offset-[6px] transition-colors duration-300 group-hover:text-wesup-red group-hover:decoration-wesup-red">
                Lanjut langkah {d.step} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
