"use client";

import { AlertCircle, Calendar, Clock, CreditCard, Truck } from "lucide-react";
import type { CatalogDraft, FieldErrors } from "@/lib/supplier-catalog/types";

interface TimelineStepProps {
  draft: CatalogDraft;
  errors: FieldErrors;
  disabled: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onFieldChange: (
    field:
      | "registrationOpensAt"
      | "registrationClosesAt"
      | "paymentOpensAt"
      | "paymentClosesAt"
      | "estimatedReadyAt",
    value: string,
  ) => void;
  paymentWindowHours?: CatalogDraft["paymentWindowHours"];
  onPaymentWindowChange?: (value: CatalogDraft["paymentWindowHours"]) => void;
}

const TIMELINE_FIELDS = [
  {
    field: "registrationOpensAt" as const,
    label: "Waktu Buka Pendaftaran",
    icon: Calendar,
    color: "",
    description: "Kapan pendaftaran dibuka untuk UMKM.",
  },
  {
    field: "registrationClosesAt" as const,
    label: "Waktu Tutup Pendaftaran",
    icon: Clock,
    color: "",
    description: "Batas akhir UMKM mendaftar.",
  },
  {
    field: "paymentOpensAt" as const,
    label: "Mulai Payment Window",
    icon: CreditCard,
    color: "text-wesup-ink-sub",
    description: "Kapan UMKM mulai bisa membayar.",
  },
  {
    field: "paymentClosesAt" as const,
    label: "Batas Akhir Payment",
    icon: CreditCard,
    color: "text-wesup-ink-sub",
    description: "Batas akhir UMKM melakukan pembayaran.",
  },
  {
    field: "estimatedReadyAt" as const,
    label: "Estimasi Barang Ready",
    icon: Truck,
    color: "",
    description: "Kapan barang siap diambil di lokasi.",
  },
] as const;

export default function TimelineStep({
  draft,
  errors,
  disabled,
  headingRef,
  onFieldChange,
  paymentWindowHours = 24,
  onPaymentWindowChange,
}: TimelineStepProps) {
  return (
    <div className="space-y-6">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-bold text-wesup-ink outline-none"
      >
        Timeline Penawaran
      </h2>
      <p className="text-sm text-wesup-ink-sub">
        Atur jadwal mutlak penawaran. Urutan waktu harus linear: Buka &lt; Tutup &lt; Mulai Payment &lt; Batas Payment &lt; Ready.
      </p>

      <div className=" border border-wesup-ink/20 bg-wesup-paper-sub p-4">
        <label htmlFor="payment-window-hours" className="block text-sm font-semibold ">Durasi jendela pembayaran</label>
        <p className="mt-1 text-xs text-wesup-ink-sub">Mulai dihitung saat batch ditutup dan invoice diterbitkan.</p>
        <select id="payment-window-hours" value={paymentWindowHours ?? 24} onChange={(e) => onPaymentWindowChange?.(Number(e.target.value) as CatalogDraft["paymentWindowHours"])} disabled={disabled} className="mt-2  border border-wesup-ink/15 bg-wesup-paper px-3 py-2 text-sm text-wesup-ink">
          {[3, 6, 12, 24].map((hours) => <option key={hours} value={hours}>{hours} jam</option>)}
        </select>
        {errors.paymentWindowHours && <p className="mt-1 text-xs font-medium text-wesup-red" role="alert">{errors.paymentWindowHours}</p>}
      </div>

      {/* Time travel warning */}
      {errors.timelineOrder && (
        <div className=" border   p-4" role="alert">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0 " />
            <p className="text-sm ">{errors.timelineOrder}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {TIMELINE_FIELDS.map(({ field, label, icon: Icon, color, description }) => (
          <div
            key={field}
            className="flex items-start gap-4  border border-wesup-ink/15 bg-wesup-paper p-4 "
          >
            <span className="mt-1 shrink-0">
              <Icon size={20} className={color} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <label
                    htmlFor={`timeline-${field}`}
                    className="text-sm font-semibold "
                  >
                    {label} <span className="text-wesup-red">*</span>
                  </label>
                  <p className="text-xs text-wesup-ink-sub">{description}</p>
                </div>
                <input
                  id={`timeline-${field}`}
                  type="datetime-local"
                  required
                  value={draft[field]}
                  onChange={(e) => onFieldChange(field, e.target.value)}
                  disabled={disabled}
                  className="mt-1  border border-wesup-ink/15 px-3 py-2 text-sm text-wesup-ink outline-none focus:border-wesup-red focus:ring-2  disabled:cursor-not-allowed disabled:bg-wesup-paper sm:mt-0"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Visual timeline */}
      <div className=" bg-wesup-paper p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-wesup-ink-sub">
          Urutan Timeline
        </p>
        <div className="flex items-center gap-1 overflow-x-auto pb-2 text-[10px] text-wesup-ink-sub">
          {TIMELINE_FIELDS.map(({ field, color }, index) => (
            <span key={field} className="flex items-center gap-1 shrink-0">
              <span className={`font-semibold ${draft[field] ? color : "text-wesup-ink-sub"}`}>
                {draft[field]
                  ? new Date(draft[field]).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--"}
              </span>
              {index < TIMELINE_FIELDS.length - 1 && (
                <span className="text-wesup-ink-sub">&rarr;</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2  bg-wesup-paper-sub p-4 text-xs text-wesup-ink">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Validasi Waktu:</p>
          <ul className="mt-1 space-y-0.5">
            <li>&bull; Semua waktu harus di masa depan.</li>
            <li>&bull; Urutan harus linear: Buka &lt; Tutup &lt; Mulai Payment &lt; Batas Payment &lt; Ready.</li>
            <li>&bull; Sistem akan menolak jika urutan tidak logis.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
