"use client";

import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Package,
  Power,
} from "lucide-react";
import type { RecurringConfig } from "@/lib/supplier-recurring/types";
import { DAY_LABELS, type DayOfWeek } from "@/lib/supplier-recurring/types";
import { formatInterval } from "@/lib/supplier-recurring/mock-data";

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

export interface RecurringCardProps {
  config: RecurringConfig;
  onToggle: (configId: string) => void;
}

export default function RecurringCard({ config, onToggle }: RecurringCardProps) {
  const isActive = config.isActive;
  const lowestPrice = config.templateBatch.tiers.at(-1)?.pricePerUnit ?? 0;
  const highestPrice = config.templateBatch.tiers.at(0)?.pricePerUnit ?? 0;
  const dayLabels = config.daysOfWeek
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d as DayOfWeek])
    .join(", ");

  return (
    <div
      className={`group block  border bg-wesup-paper  transition ${
        isActive
          ? "border-wesup-ink/20 hover:border-wesup-ink/20 hover:"
          : "border-wesup-ink/15 hover:border-wesup-ink/15 hover:"
      }`}
    >
      <div className="p-5">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span
                className={
                  isActive
                    ? "inline-flex items-center gap-1  bg-wesup-paper-sub px-2 py-0.5 text-xs font-semibold text-wesup-ink"
                    : "inline-flex items-center gap-1  bg-wesup-paper-sub px-2 py-0.5 text-xs font-semibold text-wesup-ink-sub"
                }
              >
                {isActive ? (
                  <CheckCircle2 aria-hidden="true" size={12} />
                ) : (
                  <AlertCircle aria-hidden="true" size={12} />
                )}
                {isActive ? "Aktif" : "Nonaktif"}
              </span>
              <span className=" bg-wesup-paper-sub px-2 py-0.5 text-xs font-medium text-wesup-red">
                {config.templateBatch.category}
              </span>
            </div>
            <h3 className="truncate text-base font-bold text-wesup-ink">
              {config.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onToggle(config.id)}
            className={`flex shrink-0 items-center gap-1.5  px-3 py-1.5 text-xs font-semibold transition ${
              isActive
                ? "border border-wesup-ink/20 bg-wesup-paper-sub text-wesup-ink hover:bg-wesup-paper-sub"
                : "border border-wesup-ink/15 bg-wesup-paper text-wesup-ink-sub hover:bg-wesup-paper-sub"
            }`}
            aria-label={isActive ? "Nonaktifkan jadwal" : "Aktifkan jadwal"}
          >
            <Power aria-hidden="true" size={14} />
            {isActive ? "Aktif" : "Aktifkan"}
          </button>
        </div>

        {/* Schedule Info */}
        <div className="mb-3 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-wesup-ink-sub">
            <Clock aria-hidden="true" size={14} className="shrink-0 text-wesup-ink-sub" />
            <span>{formatInterval(config.intervalDays)}</span>
            {dayLabels && (
              <span className="text-wesup-ink-sub">&middot;</span>
            )}
            {dayLabels && <span>{dayLabels}</span>}
          </div>
          {config.nextGenerationAt && (
            <div className="flex items-center gap-2 text-wesup-ink-sub">
              <CalendarClock aria-hidden="true" size={14} className="shrink-0 text-wesup-red" />
              <span>
                Batch berikutnya:{" "}
                <strong className="text-wesup-ink">
                  {dates.format(new Date(config.nextGenerationAt))}
                </strong>
              </span>
            </div>
          )}
          {config.lastGeneratedAt && (
            <div className="flex items-center gap-2 text-wesup-ink-sub">
              <Package aria-hidden="true" size={14} className="shrink-0 text-wesup-ink-sub" />
              <span>
                Terakhir generate:{" "}
                {dates.format(new Date(config.lastGeneratedAt))}
              </span>
            </div>
          )}
        </div>

        {/* Template Batch Preview */}
        <div className=" border border-wesup-ink/10 bg-wesup-paper p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-wesup-ink">
            <Package aria-hidden="true" size={12} />
            Template: {config.templateBatch.title}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-wesup-ink">
              {money.format(lowestPrice)}
            </span>
            {lowestPrice < highestPrice && (
              <span className="text-xs text-wesup-ink-sub line-through">
                {money.format(highestPrice)}
              </span>
            )}
          </div>
          <ul className="mt-1.5 space-y-0.5 text-xs text-wesup-ink-sub">
            {config.templateBatch.tiers.map((tier) => (
              <li key={tier.tierNumber} className="flex justify-between">
                <span>
                  Tier {tier.tierNumber}: {tier.minimumQuantity}–
                  {tier.maximumQuantity ?? "+"} pcs
                </span>
                <strong className="text-wesup-ink-sub 800">
                  {money.format(tier.pricePerUnit)}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-wesup-ink/10 px-5 py-3">
        <Link
          href={`/supplier/recurring/${config.id}`}
          className="text-xs font-semibold text-wesup-red hover:text-wesup-ink-sub"
        >
          Lihat Detail &rarr;
        </Link>
      </div>
    </div>
  );
}
