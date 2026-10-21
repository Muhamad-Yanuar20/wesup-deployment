"use client";

import Link from "next/link";
import { AppPanel } from "@/components/layout/AppPanel";
import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AppNotification, AppNotificationType } from "@/lib/notifications/types";

import { Alert, AsyncButton, ContentSkeleton, ErrorState } from "@/components/feedback";
import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { feedbackError, readFeedbackError } from "@/lib/feedback/errors";
import { useToast } from "@/components/ui/GlobalToast";

const typeMeta: Record<AppNotificationType, { label: string; className: string }> = {
  payment_due: { label: "Pembayaran", className: "bg-wesup-paper-sub text-wesup-ink-sub" },
  payment_success: { label: "Pembayaran", className: "bg-wesup-paper-sub text-wesup-ink-sub" },
  pickup_ready: { label: "Pengambilan", className: "bg-wesup-paper-sub text-wesup-ink-sub" },
  dispute: { label: "Sengketa", className: "bg-wesup-paper-sub text-wesup-ink" },
  refund: { label: "Refund", className: "bg-wesup-paper-sub text-wesup-ink-sub" },
  suspension: { label: "Akun", className: "bg-wesup-paper-sub text-wesup-ink" },
  referral: { label: "Referral", className: "bg-wesup-paper-sub text-wesup-ink-sub" },
  batch_update: { label: "Batch", className: "bg-wesup-paper-sub text-wesup-ink-sub" },
};

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export default function SupplierNotificationsClient() {
  const { data, loading, error, reload } = useFeedbackResource<{ notifications: AppNotification[] }>("/api/suppliers/notifications", "Notifikasi belum dapat dimuat.");
  const [readIds, setReadIds] = useState<string[]>([]), [pending, setPending] = useState(false), [mutationError, setMutationError] = useState("");
  const { toast } = useToast();
  const notifications = (data?.notifications ?? []).map(item => readIds.includes(item.id) ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item);
  const unread = notifications.filter(notification => !notification.readAt).length;
  const markAllRead = async () => {
    if (pending) return; setPending(true); setMutationError("");
    try { const response = await fetch("/api/suppliers/notifications", { method: "PATCH" }); if (!response.ok) throw await readFeedbackError(response, "Notifikasi belum dapat ditandai dibaca."); setReadIds(notifications.map(item => item.id)); toast("Semua notifikasi ditandai dibaca.", "success"); }
    catch (e) { setMutationError(feedbackError(e, "Notifikasi belum dapat ditandai dibaca. Coba lagi.")); }
    finally { setPending(false); }
  };
  if (loading && !data) return <ContentSkeleton label="Memuat notifikasi…" variant="form" />;
  if (error && !data) return <ErrorState title="Notifikasi belum dapat dimuat." description={error} action={<AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton>} />;
  return (
    <div className="space-y-5 tabular-nums">{mutationError && <Alert tone="error">{mutationError}</Alert>}{error && <Alert tone="warning" action={<button onClick={() => void reload()} className="underline">Coba perbarui</button>}>Data terakhir ditampilkan; pembaruan belum berhasil.</Alert>}
      <div className="flex flex-col justify-between gap-4 border-b border-wesup-ink/15 pb-6 sm:flex-row sm:items-end">
        <dl className="flex gap-8"><div><dt className="font-mono text-[0.6875rem] uppercase tracking-[0.14em]">Total notifikasi</dt><dd className="mt-2 font-landing-display text-3xl">{notifications.length}</dd></div><div className="border-l border-wesup-ink/15 pl-8"><dt className="font-mono text-[0.6875rem] uppercase tracking-[0.14em]">Belum dibaca</dt><dd className="mt-2 font-landing-display text-3xl">{unread}</dd></div></dl>
        {unread > 0 ? <AsyncButton type="button" pending={pending} pendingLabel="Menandai dibaca…" onClick={() => void markAllRead()} className="shrink-0"><CheckCheck className="h-4 w-4" aria-hidden="true" />Tandai semua dibaca</AsyncButton> : <span className="inline-flex min-h-11 items-center justify-center gap-1.5 bg-wesup-paper px-3 py-2 text-xs font-semibold text-wesup-ink-sub"><Check className="h-4 w-4" aria-hidden="true" />Semua sudah dibaca</span>}
      </div>
      {notifications.length === 0 ? <section className="border border-dashed border-wesup-ink/20 bg-wesup-paper"><EmptyState heading="Belum ada notifikasi" description="Pembaruan katalog dan pesanan Supplier akan muncul di sini." /></section> : <AppPanel panelClassName="!p-0"><section aria-label="Notifikasi Supplier" className="divide-y divide-wesup-ink/10">{notifications.map((notification) => <NotificationRow key={notification.id} notification={notification} />)}</section></AppPanel>}
    </div>
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const meta = typeMeta[notification.type];
  const content = <div className="flex gap-4">
    <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center border border-wesup-ink/15 ${meta.className}`}><Bell className="size-4" strokeWidth={1.5} aria-hidden="true" /></span>
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">{meta.label}</p><h2 className={`break-words text-base ${notification.readAt ? "font-medium text-wesup-ink-sub" : "font-semibold text-wesup-ink"}`}>{notification.title}</h2></div>{!notification.readAt && <span aria-label="Belum dibaca" className="mt-2 h-px w-6 shrink-0 bg-wesup-red" />}</div>
      <p className="mt-2 text-sm leading-7 text-wesup-ink-sub">{notification.message}</p>
      <time dateTime={notification.createdAt} className="mt-3 block font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-wesup-ink-sub">{dates.format(new Date(notification.createdAt))}</time>
    </div>
  </div>;
  return notification.href ? <Link href={notification.href} className="group block p-5 sm:p-7 transition-colors duration-300 wesup-ease hover:bg-wesup-paper-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">{content}</Link> : <div className="p-5 sm:p-7">{content}</div>;
}
