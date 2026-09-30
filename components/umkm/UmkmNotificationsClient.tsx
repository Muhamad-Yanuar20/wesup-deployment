"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/SkeletonLoading";
import type { AppNotification, AppNotificationType } from "@/lib/notifications/types";

const typeMeta: Record<AppNotificationType, { label: string; className: string }> = {
  payment_due: { label: "Pembayaran", className: "bg-amber-100 text-amber-700" },
  payment_success: { label: "Pembayaran", className: "bg-emerald-100 text-emerald-700" },
  pickup_ready: { label: "Pengambilan", className: "bg-blue-100 text-blue-700" },
  dispute: { label: "Sengketa", className: "bg-red-100 text-red-700" },
  refund: { label: "Refund", className: "bg-violet-100 text-violet-700" },
  suspension: { label: "Akun", className: "bg-red-100 text-red-700" },
  referral: { label: "Referral", className: "bg-teal-100 text-teal-700" },
  batch_update: { label: "Batch", className: "bg-slate-100 text-slate-700" },
};
const dates = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export default function UmkmNotificationsClient() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const unread = notifications.filter((notification) => !notification.readAt).length;
  useEffect(() => { let cancelled = false; void fetch("/api/umkm/notifications", { cache: "no-store" }).then(async (response) => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error ?? "Notifikasi belum dapat dimuat."); if (!cancelled) setNotifications(body.notifications ?? []); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Notifikasi belum dapat dimuat."); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []);
  const markAllRead = async () => { const response = await fetch("/api/umkm/notifications", { method: "PATCH" }); if (response.ok) setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt ?? new Date().toISOString() }))); };
  if (loading) return <div className="space-y-3" role="status"><Skeleton className="h-16 w-full rounded-xl" /><Skeleton className="h-20 w-full rounded-xl" /></div>;
  if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  return <div className="space-y-5"><div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-600"><strong className="text-slate-900">{notifications.length}</strong> notifikasi · <strong className="text-slate-900">{unread}</strong> belum dibaca</p>{unread > 0 ? <button type="button" onClick={() => void markAllRead()} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><CheckCheck className="h-4 w-4" aria-hidden="true" />Tandai semua dibaca</button> : <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><Check className="h-4 w-4" aria-hidden="true" />Semua sudah dibaca</span>}</div>{notifications.length === 0 ? <section className="rounded-xl border border-dashed border-slate-300 bg-white"><EmptyState heading="Belum ada notifikasi" description="Pembaruan pesanan dan batch akan muncul di sini." /></section> : <section aria-label="Notifikasi UMKM" className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">{notifications.map((notification) => <NotificationRow key={notification.id} notification={notification} />)}</section>}</div>;
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const meta = typeMeta[notification.type];
  const content = <div className="flex gap-3"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.className}`}><Bell className="h-4 w-4" aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h2 className={`text-sm ${notification.readAt ? "font-semibold text-slate-700" : "font-bold text-slate-900"}`}>{notification.title}</h2><p className="mt-1 text-sm text-slate-600">{notification.message}</p></div>{!notification.readAt ? <span aria-label="Belum dibaca" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" /> : null}</div><p className="mt-2 text-xs text-slate-400">{dates.format(new Date(notification.createdAt))}</p></div></div>;
  return notification.href ? <Link href={notification.href} className="block p-4 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600">{content}</Link> : <div className="p-4">{content}</div>;
}
