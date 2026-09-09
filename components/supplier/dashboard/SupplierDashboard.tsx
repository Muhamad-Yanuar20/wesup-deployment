"use client";

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Landmark,
  Plus,
  Package,
  TrendingUp,
  Users,
  Wallet,
  Star,
} from "lucide-react";
import { SUPPLIER_BATCH_MOCKS } from "@/lib/supplier-batch/mock-data";
import { getSupplierRatings } from "@/lib/supplier-ratings/mock-data";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const MOCK_SUPPLIER = {
  name: "Koperasi Pangan Bandung",
  isApproved: true,
};

const supplierRating = getSupplierRatings(MOCK_SUPPLIER.name);

function formatRating(average: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average);
}

function StarRow({ average }: { average: number }) {
  const filled = Math.round(average);
  return (
    <span className="flex gap-0" aria-label={`Rating rata-rata ${formatRating(average)} dari 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden="true"
          className={value <= filled ? "h-4 w-4 text-amber-500" : "h-4 w-4 text-slate-200"}
          fill={value <= filled ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

const activeBatches = SUPPLIER_BATCH_MOCKS.filter(
  (b) => b.status === "PUBLISHED",
);
const totalParticipants = activeBatches.reduce(
  (sum, b) => sum + b.participantCount,
  0,
);
const totalRevenue = activeBatches.reduce(
  (sum, b) => sum + b.paidParticipantCount * b.basePrice,
  0,
);

const recentBatches = [...SUPPLIER_BATCH_MOCKS]
  .sort(
    (a, b) =>
      new Date(b.timeline.registrationOpensAt).getTime() -
      new Date(a.timeline.registrationOpensAt).getTime(),
  )
  .slice(0, 3);

function progressFor(registered: number, target: number): number {
  return target <= 0 ? 0 : Math.min(100, Math.max(0, (registered / target) * 100));
}

export default function SupplierDashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Selamat datang, {MOCK_SUPPLIER.name}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              {MOCK_SUPPLIER.isApproved ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 aria-hidden="true" size={14} />
                  Akun Disetujui
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  <AlertCircle aria-hidden="true" size={14} />
                  Menunggu Verifikasi
                </span>
              )}
            </div>
          </div>
          <Link
            href="/supplier/catalog/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <Plus aria-hidden="true" size={18} />
            Buat Penawaran Baru
          </Link>
        </div>
      </section>

      {/* Stats Cards */}
      <section aria-label="Ringkasan aktivitas">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Package className="text-blue-600" size={20} />}
            iconBg="bg-blue-100"
            label="Katalog Aktif"
            value={String(activeBatches.length)}
          />
          <StatCard
            icon={<Users className="text-indigo-600" size={20} />}
            iconBg="bg-indigo-100"
            label="Total Peserta"
            value={String(totalParticipants)}
          />
          <StatCard
            icon={<TrendingUp className="text-emerald-600" size={20} />}
            iconBg="bg-emerald-100"
            label="Pendapatan Terkumpul"
            value={money.format(totalRevenue)}
          />
          <StatCard
            icon={<Wallet className="text-amber-600" size={20} />}
            iconBg="bg-amber-100"
            label="Siap Cair"
            value={money.format(totalRevenue)}
          />
        </div>
      </section>

      {/* Reputasi & Penilaian */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Reputasi & Penilaian</h2>
          <Link
            href="/supplier/akun/ulasan"
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            Lihat Ulasan
            <ChevronRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <Link
          href="/supplier/akun/ulasan"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:gap-6 sm:p-5"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <Star aria-hidden="true" className="h-6 w-6 fill-amber-500 text-amber-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              Rating aktif dari pembeli UMKM
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl font-extrabold text-slate-900">
                {supplierRating ? formatRating(supplierRating.average) : "—"}
              </span>
              <StarRow average={supplierRating?.average ?? 0} />
              <span className="text-sm text-slate-500">
                dari {supplierRating ? supplierRating.total : "0"} ulasan
              </span>
            </div>
          </div>
          <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-300" />
        </Link>
      </section>

      {/* Recent Catalogs */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Katalog Terbaru
          </h2>
          <div className="flex items-center gap-4">
            <Link
              href="/supplier/recurring"
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              Penawaran Berulang
              <ChevronRight aria-hidden="true" size={16} />
            </Link>
            <Link
              href="/supplier/catalog"
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              Lihat Semua
              <ChevronRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </div>

        {recentBatches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <Package
              aria-hidden="true"
              size={40}
              className="mx-auto text-slate-300"
            />
            <p className="mt-3 text-sm font-medium text-slate-500">
              Belum ada katalog. Mulai buat penawaran pertama Anda.
            </p>
            <Link
              href="/supplier/catalog/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus aria-hidden="true" size={16} />
              Buat Penawaran
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentBatches.map((batch) => {
              const cancelled = batch.status === "CANCELLED_BY_SUPPLIER";
              const progress = progressFor(
                batch.registeredQuantity,
                batch.targetQuantity,
              );

              return (
                <Link
                  key={batch.id}
                  href={`/supplier/batch/${batch.id}`}
                  className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={
                            cancelled
                              ? "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"
                              : "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                          }
                        >
                          {cancelled ? "Dibatalkan" : "Aktif"}
                        </span>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                          {batch.category}
                        </span>
                      </div>
                      <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-blue-700">
                        {batch.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {batch.displayCode} &middot;{" "}
                        {dates.format(
                          new Date(batch.timeline.registrationOpensAt),
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 sm:text-right">
                      <div className="min-w-[100px]">
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-500 sm:justify-end sm:gap-3">
                          <span>
                            {batch.registeredQuantity}/{batch.targetQuantity}{" "}
                            pcs
                          </span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        size={18}
                        className="shrink-0 text-slate-300 group-hover:text-blue-500"
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Keuangan & Laporan */}
      <section aria-label="Keuangan dan laporan">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Keuangan &amp; Laporan
          </h2>
          <Link
            href="/supplier/akun/rekening"
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            Pengaturan Rekening
            <ChevronRight aria-hidden="true" size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            href="/supplier/akun/rekening"
            icon={<Landmark className="text-blue-600" size={20} />}
            iconBg="bg-blue-100"
            title="Pengaturan Rekening"
            description="Atur rekening tujuan pencairan dana escrow."
          />
          <QuickLink
            href="/supplier/akun/escrow"
            icon={<Wallet className="text-emerald-600" size={20} />}
            iconBg="bg-emerald-100"
            title="Monitoring Escrow"
            description="Pantau dana dibekukan, dirilis, atau hangus."
          />
          <QuickLink
            href="/supplier/akun/laporan"
            icon={<FileText className="text-amber-600" size={20} />}
            iconBg="bg-amber-100"
            title="Lapor UMKM"
            description="Laporkan UMKM bermasalah beserta bukti."
          />
          <QuickLink
            href="/supplier/akun/laporan/riwayat"
            icon={<Clock3 className="text-indigo-600" size={20} />}
            iconBg="bg-indigo-100"
            title="Riwayat Laporan"
            description="Lacak status laporan yang Anda kirim."
          />
        </div>
      </section>

      {/* Quick Info */}
      <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
        <h3 className="text-sm font-bold text-blue-900">Informasi Penting</h3>
        <ul className="mt-2 space-y-1 text-sm text-blue-800">
          <li>
            &bull; Katalog baru akan tayang di marketplace setelah dikonfirmasi.
          </li>
          <li>
            &bull; Lokasi pengambilan terkunci otomatis setelah ada 1 peserta
            terdaftar.
          </li>
          <li>
            &bull; Skema harga tier terkunci otomatis setelah ada peserta
            terdaftar.
          </li>
          <li>
            &bull; Dana escrow akan cair otomatis 24 jam setelah serah terima
            fisik.
          </li>
        </ul>
      </section>
    </div>
  );
}

function StatCard({
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="truncate text-lg font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  iconBg,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700">
            {title}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <ChevronRight
          aria-hidden="true"
          size={18}
          className="shrink-0 text-slate-300 group-hover:text-blue-500"
        />
      </div>
    </Link>
  );
}
