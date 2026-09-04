"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  PackageCheck,
  ShoppingBag,
  User,
  XCircle,
} from "lucide-react";
import { ACCOUNT_ORDER_MOCKS } from "@/lib/orders/mock-data";
import type { AccountOrder, AccountOrderStatus } from "@/lib/orders/types";
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

const STATUS_BADGE: Record<AccountOrderStatus, { label: string; className: string; dot: string }> = {
  registered: { label: "Terdaftar", className: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  pending_payment: { label: "Menunggu Bayar", className: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  paid: { label: "Lunas", className: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  picked_up: { label: "Sudah Diambil", className: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  no_show: { label: "Tidak Hadir", className: "bg-red-100 text-red-700", dot: "bg-red-500" },
  cancelled: { label: "Dibatalkan", className: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

export default function OrderCenterClient() {
  // Simulate a short load to exercise skeleton/empty states like the rest of the app.
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading] = useState(false);

  const visibleOrders = useMemo(() => {
    if (filter === "ALL") return ACCOUNT_ORDER_MOCKS;
    return ACCOUNT_ORDER_MOCKS.filter((o) => o.status === filter);
  }, [filter]);

  const counts = useMemo(() => {
    const count = (key: Filter) =>
      key === "ALL"
        ? ACCOUNT_ORDER_MOCKS.length
        : ACCOUNT_ORDER_MOCKS.filter((o) => o.status === key).length;
    return count;
  }, []);

  const paidCount = counts("paid");
  const pickedUpCount = counts("picked_up");
  const pendingCount = counts("pending_payment");

  return (
    <div className="space-y-6">
      <FilterStrip filter={filter} onChange={setFilter} counts={counts} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={<ShoppingBag className="text-indigo-600" size={20} />} iconBg="bg-indigo-100" label="Total Pesanan" value={String(counts("ALL"))} />
        <SummaryCard icon={<Clock className="text-amber-600" size={20} />} iconBg="bg-amber-100" label="Menunggu Bayar" value={String(pendingCount)} />
        <SummaryCard icon={<CheckCircle2 className="text-blue-600" size={20} />} iconBg="bg-blue-100" label="Lunas (siap ambil)" value={String(paidCount)} />
        <SummaryCard icon={<PackageCheck className="text-emerald-600" size={20} />} iconBg="bg-emerald-100" label="Sudah Diambil" value={String(pickedUpCount)} />
      </section>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : visibleOrders.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white shadow-sm">
          <EmptyState
            heading="Tidak ada pesanan"
            description={`Belum ada pesanan berstatus "${
              FILTERS.find((f) => f.key === filter)?.label
            }".`}
            action={<Link href="/marketplace" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Jelajahi batch<ArrowRight className="size-4" aria-hidden="true" /></Link>}
          />
        </section>
      ) : (
        <section aria-label="Daftar pesanan" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Batch</th>
                  <th className="px-4 py-3 font-medium">Mitra</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleOrders.map((o) => (
                  <OrderRow key={o.id} order={o} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 md:hidden">
            {visibleOrders.map((o) => (
              <OrderCard key={o.id} order={o} />
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
    <section className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={filter === key}
          className={
            filter === key
              ? "rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
              : "rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
          }
        >
          {label}
          <span className="ml-1 text-[10px] opacity-70">({counts(key)})</span>
        </button>
      ))}
    </section>
  );
}

function StatusBadge({ status }: { status: AccountOrderStatus }) {
  const meta = STATUS_BADGE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function RoleTag({ role }: { role: AccountOrder["role"] }) {
  return role === "supplier" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
      <User className="h-3 w-3" aria-hidden="true" /> Supplier
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
      <ShoppingBag className="h-3 w-3" aria-hidden="true" /> Buyer
    </span>
  );
}

function OrderRow({ order }: { order: AccountOrder }) {
  return (
    <tr className="transition hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-900">{order.batchTitle}</p>
          <RoleTag role={order.role} />
        </div>
        <p className="font-mono text-xs text-slate-400">{order.batchDisplayCode}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-slate-700">{order.counterparty}</p>
        <p className="text-xs text-slate-400">{dates.format(new Date(order.createdAt))}</p>
      </td>
      <td className="px-4 py-3">
        {order.quantity} {order.unit}
        {order.lockedTier ? <span className="ml-1 text-xs text-slate-400">· T{order.lockedTier}</span> : null}
      </td>
      <td className="px-4 py-3 font-semibold text-slate-900">{money.format(order.finalAmount)}</td>
      <td className="px-4 py-3">
        <StatusBadge status={order.status} />
      </td>
      <td className="px-4 py-3 text-right">
        {order.pickupUrl ? (
          <Link href={order.pickupUrl} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">
            Serah Terima
          </Link>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}

function OrderCard({ order }: { order: AccountOrder }) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900">{order.batchTitle}</p>
            <RoleTag role={order.role} />
          </div>
          <p className="font-mono text-xs text-slate-400">{order.batchDisplayCode}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
        <span>Mitra: <strong className="text-slate-900">{order.counterparty}</strong></span>
        <span>Qty: <strong className="text-slate-900">{order.quantity} {order.unit}</strong></span>
        <span>Total: <strong className="text-slate-900">{money.format(order.finalAmount)}</strong></span>
        <span>Daftar: <strong className="text-slate-900">{dates.format(new Date(order.createdAt))}</strong></span>
      </div>
      {order.pickupUrl ? (
        <Link href={order.pickupUrl} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">
          Serah Terima
        </Link>
      ) : (
        <span className="mt-3 inline-flex items-center gap-1 text-xs text-slate-300">
          <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Belum ada aksi
        </span>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
          <p className="truncate text-lg font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}