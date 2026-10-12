"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AppNotification, AppNotificationType } from "@/lib/notifications/types";

import { Alert, AsyncButton, ContentSkeleton, ErrorState } from "@/components/feedback";
import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { feedbackError, readFeedbackError } from "@/lib/feedback/errors";
import { useToast } from "@/components/ui/GlobalToast";

/* Type is expressed as a mono label; only dispute/suspension read as alerts. */
const typeMeta: Record<AppNotificationType, { label: string; alert: boolean }> = {
  payment_due: { label: "Pembayaran", alert: false },
  payment_success: { label: "Pembayaran", alert: false },
  pickup_ready: { label: "Pengambilan", alert: false },
  dispute: { label: "Sengketa", alert: true },
  refund: { label: "Refund", alert: false },
  suspension: { label: "Akun", alert: true },
  referral: { label: "Referral", alert: false },
  batch_update: { label: "Batch", alert: false },
};
const dates = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export default function UmkmNotificationsClient() {
  const { data, loading, error, reload } = useFeedbackResource<{ notifications: AppNotification[] }>("/api/umkm/notifications", "Notifikasi belum dapat dimuat.");
  const [readIds, setReadIds] = useState<string[]>([]), [pending, setPending] = useState(false), [mutationError, setMutationError] = useState("");
  const { toast } = useToast();
  const notifications = (data?.notifications ?? []).map(item => readIds.includes(item.id) ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item);
  const unread = notifications.filter(notification => !notification.readAt).length;
  const markAllRead = async () => {
    if (pending) return; setPending(true); setMutationError("");
    try { const response = await fetch("/api/umkm/notifications", { method: "PATCH" }); if (!response.ok) throw await readFeedbackError(response, "Notifikasi belum dapat ditandai dibaca."); setReadIds(notifications.map(item => item.id)); toast("Semua notifikasi ditandai dibaca.", "success"); }
    catch (e) { setMutationError(feedbackError(e, "Notifikasi belum dapat ditandai dibaca. Coba lagi.")); }
    finally { setPending(false); }
  };
  if (loading && !data) return <ContentSkeleton label="Memuat notifikasi…" variant="form" />;
  if (error && !data) return <ErrorState title="Notifikasi belum dapat dimuat." description={error} action={<AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton>} />;
  return <div className="space-y-5">
    {mutationError && <Alert tone="error">{mutationError}</Alert>}
    {error && <Alert tone="warning" action={<button onClick={() => void reload()} className="underline">Coba perbarui</button>}>Data terakhir ditampilkan; pembaruan belum berhasil.</Alert>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-wesup-ink-sub"><strong className="tabular-nums text-wesup-ink">{notifications.length}</strong> notifikasi · <strong className="tabular-nums text-wesup-ink">{unread}</strong> belum dibaca</p>
      {unread > 0 ? (
        <AsyncButton type="button" pending={pending} pendingLabel="Menandai dibaca…" onClick={() => void markAllRead()} className="inline-flex min-h-11 items-center gap-1.5 border border-wesup-ink/20 bg-wesup-paper px-4 py-2.5 text-xs font-semibold text-wesup-ink hover:border-wesup-ink hover:bg-wesup-paper-sub hover:translate-x-0 disabled:hover:bg-wesup-paper-sub"><CheckCheck className="size-4" strokeWidth={1.5} aria-hidden="true" />Tandai semua dibaca</AsyncButton>
      ) : (
        <span className="inline-flex items-center gap-1.5 border border-wesup-ink/15 bg-wesup-paper-sub px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub"><Check className="size-4" strokeWidth={1.5} aria-hidden="true" />Semua sudah dibaca</span>
      )}
    </div>
    {notifications.length === 0 ? (
      <section className="border border-wesup-ink/15 bg-wesup-paper"><EmptyState heading="Belum ada notifikasi" description="Pembaruan pesanan dan batch akan muncul di sini." /></section>
    ) : (
      <section aria-label="Notifikasi UMKM" className="divide-y divide-wesup-ink/10 border border-wesup-ink/15 bg-wesup-paper">{notifications.map((notification) => <NotificationRow key={notification.id} notification={notification} />)}</section>
    )}
  </div>;
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const meta = typeMeta[notification.type];
  const content = (
    <div className="flex gap-3">
      <span aria-hidden="true" className={`mt-0.5 block h-full w-0.5 shrink-0 self-stretch ${notification.readAt ? "bg-transparent" : "bg-wesup-red"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] ${meta.alert ? "bg-wesup-red text-wesup-paper" : "bg-wesup-paper-sub text-wesup-ink-sub"}`}><Bell className="size-3" strokeWidth={1.5} aria-hidden="true" />{meta.label}</span>
            <h2 className={`mt-2 text-sm ${notification.readAt ? "font-semibold text-wesup-ink-sub" : "font-bold text-wesup-ink"}`}>{notification.title}</h2>
            <p className="mt-1 text-sm leading-6 text-wesup-ink-sub">{notification.message}</p>
          </div>
          {!notification.readAt ? <span aria-label="Belum dibaca" className="mt-1 size-2.5 shrink-0 bg-wesup-red" /> : null}
        </div>
        <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub/70 tabular-nums">{dates.format(new Date(notification.createdAt))}</p>
      </div>
    </div>
  );
  return notification.href
    ? <Link href={notification.href} className="block p-4 transition-colors duration-300 wesup-ease hover:bg-wesup-paper-sub focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wesup-red">{content}</Link>
    : <div className="p-4">{content}</div>;
}
