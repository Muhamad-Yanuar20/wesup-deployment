"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  PackageCheck,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Star,
  User,
} from "lucide-react";
import { ACCOUNT_ORDER_MOCKS } from "@/lib/orders/mock-data";
import { getComplaintScenario } from "@/lib/dispute/mock-data";
import { getRatingScenarioForOrder } from "@/lib/ratings/mock-data";
import type { AccountOrder, AccountOrderStatus } from "@/lib/orders/types";
import type { UserRole } from "@/types/database";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/SkeletonLoading";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

type Filter = "ALL" | AccountOrderStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "pending_payment", label: "Menunggu Bayar" },
  { key: "paid", label: "Lunas" },
  { key: "picked_up", label: "Diambil" },
  { key: "registered", label: "Terdaftar" },
  { key: "no_show", label: "Tidak Hadir" },
  { key: "cancelled", label: "Dibatalkan" },
];

/* Red = signal only; only no_show/cancelled are alert chips. */
const STATUS_BADGE: Record<AccountOrderStatus, { label: string; alert: boolean }> = {
  registered: { label: "Terdaftar", alert: false },
  pending_payment: { label: "Menunggu Bayar", alert: false },
  paid: { label: "Lunas", alert: false },
  picked_up: { label: "Sudah Diambil", alert: false },
  completed: { label: "Selesai", alert: false },
  no_show: { label: "Tidak Hadir", alert: true },
  cancelled: { label: "Dibatalkan", alert: true },
  refund_pending: { label: "Proses Refund", alert: false },
  refunded: { label: "Refund Selesai", alert: false },
};

const chipPrimary = "inline-flex min-h-11 items-center gap-1.5 border border-wesup-ink bg-wesup-ink px-3 py-1.5 text-xs font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5";
const chipSecondary = "inline-flex min-h-11 items-center gap-1.5 border border-wesup-ink/20 bg-wesup-paper px-3 py-1.5 text-xs font-semibold text-wesup-ink transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub";
const chipAlert = "inline-flex min-h-11 items-center gap-1.5 border border-wesup-red bg-wesup-paper px-3 py-1.5 text-xs font-semibold text-wesup-red transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub";

function PaymentAction({ order, canPay }: { order: AccountOrder; canPay: boolean }) {
  if (!canPay) return null;
  if (!order.paymentUrl) return null;
  const isPending = order.status === "pending_payment";
  return (
    <Link href={order.paymentUrl} className={chipPrimary}>
      {isPending ? "Bayar Sekarang" : "Jadwal Bayar"}
    </Link>
  );
}

function WaitingNote({ order }: { order: AccountOrder }) {
  if (order.status !== "registered") return null;
  return (
    <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub/70">
      Menunggu jendela pembayaran dibuka.
    </p>
  );
}

/**
 * CTA serah terima mengikuti role & status (PRD 2.2.4): UMKM (buyer) melihat
 * kredensial pengambilan (QR + PIN) di halaman pesanannya sendiri, hanya
 * setelah tagihan lunas. Supplier tetap diarahkan ke pemindai batch.
 */
function pickupHref(order: AccountOrder): string | null {
  if (order.status !== "paid") return null;
  return order.role === "buyer"
    ? `/pesanan/${order.id}/serah-terima`
    : (order.pickupUrl ?? null);
}

function PickupAction({ order }: { order: AccountOrder }) {
  const href = pickupHref(order);
  if (!href) {
    return <span className="text-xs text-wesup-ink-sub/50" aria-hidden="true">—</span>;
  }
  return (
    <Link href={href} className={chipSecondary}>
      <QrCode aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
      Serah Terima
    </Link>
  );
}

/**
 * CTA penilaian mengikuti aturan PRD 2.2.6: hanya dirender untuk UMKM (buyer)
 * dengan status serah terima rampung (picked_up) dan belum pernah menilai.
 * No-Show & sudah dinilai sengaja tidak menampilkan entri yang bisa diklik.
 */
function RatingAction({ order }: { order: AccountOrder }) {
  if (order.role !== "buyer" || order.status !== "picked_up") return null;
  const scenario = getRatingScenarioForOrder(order.id);
  if (scenario.kind !== "unlocked") return null;
  return (
    <Link href={`/pesanan/${order.id}/nilai`} className={chipSecondary}>
      <Star aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
      Nilai &amp; Ulas
    </Link>
  );
}

function ComplaintAction({ order }: { order: AccountOrder }) {
  if (order.status !== "picked_up") return null;
  const scenario = getComplaintScenario(order.id);
  if (scenario?.kind === "filed") {
    return (
      <Link href={`/pesanan/${order.id}/sengketa`} className={chipAlert}>
        <ShieldCheck aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
        Lacak Sengketa
      </Link>
    );
  }
  if (scenario?.kind === "window_open") {
    return (
      <Link href={`/pesanan/${order.id}/komplain`} className={chipAlert}>
        <ShieldAlert aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
        Ajukan Komplain
      </Link>
    );
  }
  return null;
}

export interface OrderCenterClientProps {
  /** Active viewer's role from the server session. */
  viewerRole: UserRole;
}

export default function OrderCenterClient({ viewerRole }: OrderCenterClientProps) {
  // Simulate a short load to exercise skeleton/empty states like the rest of the app.
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading] = useState(false);

  const belongsToViewer = useMemo(() => {
    if (viewerRole === "umkm") return (order: AccountOrder) => order.role === "buyer";
    if (viewerRole === "supplier") return (order: AccountOrder) => order.role === "supplier";
    return () => true;
  }, [viewerRole]);

  const visibleOrders = useMemo(() => {
    const pool = ACCOUNT_ORDER_MOCKS.filter(belongsToViewer);
    if (filter === "ALL") return pool;
    return pool.filter((o) => o.status === filter);
  }, [filter, belongsToViewer]);

  const counts = useMemo(() => {
    const pool = ACCOUNT_ORDER_MOCKS.filter(belongsToViewer);
    return (key: Filter) =>
      key === "ALL" ? pool.length : pool.filter((o) => o.status === key).length;
  }, [belongsToViewer]);

  const paidCount = counts("paid");
  const pickedUpCount = counts("picked_up");
  const pendingCount = counts("pending_payment");

  return (
    <div className="space-y-6">
      <FilterStrip filter={filter} onChange={setFilter} counts={counts} />

      <section className="grid grid-cols-2 gap-px border border-wesup-ink/10 bg-wesup-ink/10 lg:grid-cols-4">
        <SummaryCell icon={<ShoppingBag className="size-4" strokeWidth={1.5} />} label="Total Pesanan" value={String(counts("ALL"))} />
        <SummaryCell icon={<Clock className="size-4" strokeWidth={1.5} />} label="Menunggu Bayar" value={String(pendingCount)} />
        <SummaryCell icon={<CheckCircle2 className="size-4" strokeWidth={1.5} />} label="Lunas (siap ambil)" value={String(paidCount)} />
        <SummaryCell icon={<PackageCheck className="size-4" strokeWidth={1.5} />} label="Sudah Diambil" value={String(pickedUpCount)} />
      </section>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : visibleOrders.length === 0 ? (
        <section className="border border-wesup-ink/15 bg-wesup-paper">
          <EmptyState
            heading="Tidak ada pesanan"
            description={`Belum ada pesanan berstatus "${
              FILTERS.find((f) => f.key === filter)?.label
            }".`}
            action={<Link href="/marketplace" className={chipPrimary}>Jelajahi batch<ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" /></Link>}
          />
        </section>
      ) : (
        <section aria-label="Daftar pesanan" className="border border-wesup-ink/15 bg-wesup-paper">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-wesup-ink/15 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">
                <tr>
                  <th className="px-4 py-3 font-medium">Batch</th>
                  <th className="px-4 py-3 font-medium">Mitra</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wesup-ink/10">
                {visibleOrders.map((o) => (
                  <OrderRow key={o.id} order={o} viewerRole={viewerRole} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-wesup-ink/10 md:hidden">
            {visibleOrders.map((o) => (
              <OrderCard key={o.id} order={o} viewerRole={viewerRole} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FilterStrip({
  filter,
  onChange,
  counts,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
  counts: (key: Filter) => number;
}) {
  return (
    <section className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Filter pesanan">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={filter === key}
          className={`whitespace-nowrap px-3 py-1.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] transition-colors duration-300 wesup-ease ${
            filter === key
              ? "bg-wesup-ink text-wesup-paper"
              : "border border-wesup-ink/20 bg-wesup-paper text-wesup-ink-sub hover:bg-wesup-paper-sub hover:text-wesup-ink"
          }`}
        >
          {label}
          <span className="ml-1 tabular-nums opacity-70">({counts(key)})</span>
        </button>
      ))}
    </section>
  );
}

function StatusChip({ status }: { status: AccountOrderStatus }) {
  const meta = STATUS_BADGE[status];
  return (
    <span className={`inline-flex items-center px-2 py-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] ${meta.alert ? "bg-wesup-red text-wesup-paper" : "bg-wesup-paper-sub text-wesup-ink"}`}>
      {meta.label}
    </span>
  );
}

function RoleTag({ role }: { role: AccountOrder["role"] }) {
  return role === "supplier" ? (
    <span className="inline-flex items-center gap-1 bg-wesup-paper-sub px-2 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-wesup-ink-sub">
      <User className="size-3" strokeWidth={1.5} aria-hidden="true" /> Supplier
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 bg-wesup-paper-sub px-2 py-0.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-wesup-ink-sub">
      <ShoppingBag className="size-3" strokeWidth={1.5} aria-hidden="true" /> Buyer
    </span>
  );
}

function OrderRow({ order, viewerRole }: { order: AccountOrder; viewerRole: UserRole }) {
  const canPay = viewerRole === "umkm";
  const showRoleTag = viewerRole === "admin";
  return (
    <tr className="transition-colors duration-300 wesup-ease hover:bg-wesup-paper-sub">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-wesup-ink">{order.batchTitle}</p>
          {showRoleTag && <RoleTag role={order.role} />}
        </div>
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">{order.batchDisplayCode}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-wesup-ink">{order.counterparty}</p>
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">{dates.format(new Date(order.createdAt))}</p>
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold tabular-nums text-wesup-ink">{order.quantity} {order.unit}</p>
        <WaitingNote order={order} />
      </td>
      <td className="px-4 py-3 font-semibold tabular-nums text-wesup-ink">{money.format(order.finalAmount)}</td>
      <td className="px-4 py-3">
        <StatusChip status={order.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-1.5">
          {order.status === "pending_payment" && <PaymentAction order={order} canPay={canPay} />}
          {order.status === "registered" && <PaymentAction order={order} canPay={canPay} />}
          <PickupAction order={order} />
          <ComplaintAction order={order} />
          <RatingAction order={order} />
        </div>
      </td>
    </tr>
  );
}

function OrderCard({ order, viewerRole }: { order: AccountOrder; viewerRole: UserRole }) {
  const canPay = viewerRole === "umkm";
  const showRoleTag = viewerRole === "admin";
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-wesup-ink">{order.batchTitle}</p>
            {showRoleTag && <RoleTag role={order.role} />}
          </div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">{order.batchDisplayCode}</p>
        </div>
        <StatusChip status={order.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">
        <div className="flex gap-1.5"><dt>Mitra:</dt><dd className="truncate font-semibold normal-case text-wesup-ink">{order.counterparty}</dd></div>
        <div className="flex gap-1.5"><dt>Qty:</dt><dd className="font-semibold tabular-nums text-wesup-ink">{order.quantity} {order.unit}</dd></div>
        <div className="flex gap-1.5"><dt>Total:</dt><dd className="font-semibold tabular-nums text-wesup-ink">{money.format(order.finalAmount)}</dd></div>
        <div className="flex gap-1.5"><dt>Daftar:</dt><dd className="font-semibold tabular-nums text-wesup-ink">{dates.format(new Date(order.createdAt))}</dd></div>
      </dl>
      <WaitingNote order={order} />
      <div className="mt-3 flex flex-wrap gap-2">
        {(order.status === "pending_payment" || order.status === "registered") && (
          <PaymentAction order={order} canPay={canPay} />
        )}
        <PickupAction order={order} />
        <ComplaintAction order={order} />
        <RatingAction order={order} />
      </div>
    </div>
  );
}

function SummaryCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-wesup-paper p-4">
      <span aria-hidden="true" className="mb-3 flex size-8 items-center justify-center border border-wesup-ink/20 text-wesup-red">{icon}</span>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">{label}</p>
      <p className="mt-1 font-landing-display text-2xl uppercase tabular-nums tracking-[0.02em] text-wesup-ink">{value}</p>
    </div>
  );
}
