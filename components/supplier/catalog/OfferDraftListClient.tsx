"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { listOwnerOfferRecoveries, type LocalOfferRecovery } from "@/lib/supplier-catalog/local-recovery";
import { localOfferRecoveryHref, mergeOfferDrafts, type AccountOfferDraft } from "@/lib/supplier-catalog/draft-list";
import { Alert, ContentSkeleton, AsyncButton } from "@/components/feedback";
import { AppPanel } from "@/components/layout/AppPanel";

const action = "inline-flex min-h-11 items-center px-3 py-2 text-sm font-semibold text-wesup-ink underline underline-offset-4 transition-colors duration-300 wesup-ease hover:text-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red";

export default function OfferDraftListClient({ ownerId }: { ownerId: string }) {
  const { data, loading, error, reload } = useFeedbackResource<{ items: AccountOfferDraft[] }>("/api/suppliers/offers", "Draft belum dapat dimuat.");
  const [locals, setLocals] = useState<LocalOfferRecovery[]>([]);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    let active = true;
    const readLocal = () => {
      if (!active) return;
      try { setLocals(listOwnerOfferRecoveries(localStorage, ownerId)); setStorageError(false); }
      catch { setStorageError(true); }
    };
    const refresh = () => { if (document.visibilityState === "visible") { readLocal(); void reload(); } };
    queueMicrotask(readLocal);
    window.addEventListener("storage", readLocal);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; window.removeEventListener("storage", readLocal); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [ownerId, reload]);
  const rows = mergeOfferDrafts(data?.items ?? [], locals);
  if (!rows.length && !loading && !error && !storageError) return null;
  return <AppPanel className="mb-6" panelClassName="!p-4 sm:!p-5">
    <section aria-label="Draft penawaran belum selesai">
      <h2 className="font-landing-display text-xl font-normal uppercase tracking-[0.04em] text-wesup-ink">Draft belum selesai</h2>
      {loading && !data && <ContentSkeleton label="Memuat draft tersimpan…" variant="form" />}
      {error && <Alert tone="warning"><p>{error}</p><AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton></Alert>}
      {storageError && <Alert tone="warning">Draft perangkat belum dapat dibaca. Draft tersimpan di akun tetap tersedia.</Alert>}
      <ul className="mt-4 divide-y divide-wesup-ink/10 border-y border-wesup-ink/10">
        {rows.map(row => <li key={row.identity} className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="break-words text-sm font-semibold text-wesup-ink">{row.account?.payload.title || row.local?.draft.title || "Penawaran tanpa nama"}</p>
            <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-wesup-ink-sub"><span>{row.account ? "Tersimpan di akun" : "Hanya di perangkat ini"}</span> · Langkah {row.account?.step ?? row.local?.step}</p>
            {row.account && row.hasLocalChanges && row.local && <p className="mt-1 text-xs text-wesup-ink-sub">Salinan perangkat: {row.local.draft.title || "Penawaran tanpa nama"} · Langkah {row.local.step}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            {row.account && <Link className={action} href={`/supplier/catalog/new?draft=${row.account.id}`}>Lanjutkan draft tersimpan</Link>}
            {row.local && row.hasLocalChanges && <Link className={action} href={localOfferRecoveryHref(row.local, row.account?.id)}>{row.account ? "Pulihkan perubahan perangkat" : "Lanjutkan draft perangkat"}</Link>}
          </div>
        </li>)}
      </ul>
    </section>
  </AppPanel>;
}
