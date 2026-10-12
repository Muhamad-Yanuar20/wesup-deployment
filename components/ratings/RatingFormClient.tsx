"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Lock,
  Star,
  StarOff,
  ThumbsUp,
} from "lucide-react";
import type { AccountOrder } from "@/lib/orders/types";
import type {
  RatingScenario,
  RatingScore,
} from "@/lib/ratings/types";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

const STAR_SCORES: RatingScore[] = [1, 2, 3, 4, 5];

const SCORE_HINTS: Record<RatingScore, string> = {
  1: "Sangat buruk",
  2: "Buruk",
  3: "Cukup",
  4: "Baik",
  5: "Sangat baik",
};

function scoreHint(score: RatingScore): string {
  return `${score} bintang — ${SCORE_HINTS[score]}`;
}

const panel = "border border-wesup-ink/15 bg-wesup-paper";
const primaryBtn = "inline-flex min-h-11 items-center gap-1.5 border border-wesup-ink bg-wesup-ink px-4 py-2 text-sm font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5";
const secondaryBtn = "inline-flex min-h-11 items-center justify-center gap-1.5 border border-wesup-ink/20 bg-wesup-paper px-4 py-2 text-sm font-semibold text-wesup-ink transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub";

export default function RatingFormClient({
  order,
  scenario,
}: {
  order: AccountOrder;
  scenario: RatingScenario;
}) {
  const [score, setScore] = useState<RatingScore | null>(null);
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // validasi
  switch (scenario.kind) {
    case "already_rated":
      return <AlreadyRatedPanel order={order} score={scenario.rating.score} comment={scenario.rating.comment} createdAt={scenario.rating.createdAt} />;
    case "blocked_no_show":
      return (
        <div className="space-y-6">
          <OrderHeader order={order} />
          <NoticePanel
            tone="danger"
            icon={<StarOff aria-hidden="true" className="size-5" strokeWidth={1.5} />}
            title="Rating diblokir"
            description="Transaksi ini diakhiri dengan status Tidak Hadir (No-Show), sehingga akses memberikan penilaian diblokir secara mutlak."
          />
        </div>
      );
    case "locked_pre_pickup":
      return (
        <div className="space-y-6">
          <OrderHeader order={order} />
          <NoticePanel
            tone="muted"
            icon={<Lock aria-hidden="true" className="size-5" strokeWidth={1.5} />}
            title="Belum bisa menilai"
            description="Kolom rating terkunci hingga serah terima fisik selesai. Form penilaian hanya dirender setelah pesanan berstatus Sudah Diambil."
          />
        </div>
      );
    case "unlocked":
      break;
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!score) {
      setFormError("Pilih rating bintang 1 sampai 5 terlebih dahulu.");
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="space-y-6">
        <OrderHeader order={order} />
        <NoticePanel
          tone="success"
          icon={<ThumbsUp aria-hidden="true" className="size-5" strokeWidth={1.5} />}
          title="Penilaian berhasil dikirim"
          description={`Terima kasih! Penilaian ${scoreHint(score as RatingScore)} untuk ${order.counterparty} sudah tercatat. Penilaian hanya dapat diberikan sekali per transaksi.`}
          action={
            <Link href="/pesanan" className={primaryBtn}>
              Kembali ke Pesanan
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OrderHeader order={order} />

      <section
        aria-label="Informasi transaksi"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 border border-wesup-ink/15 bg-wesup-paper p-4 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub"
      >
        <span>Batch: <strong className="font-semibold normal-case text-wesup-ink">{order.batchTitle}</strong></span>
        <span>{order.batchDisplayCode}</span>
        <span>Qty: <strong className="font-semibold tabular-nums normal-case text-wesup-ink">{order.quantity} {order.unit}</strong></span>
        <span>Total: <strong className="font-semibold tabular-nums normal-case text-wesup-ink">{money.format(order.finalAmount)}</strong></span>
      </section>

      <form onSubmit={handleSubmit} noValidate className={`${panel} space-y-6 p-5 sm:p-6`}>
        <fieldset>
          <legend className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">
            Berikan rating bintang
          </legend>
          <p className="mt-1 text-xs leading-5 text-wesup-ink-sub">
            Seberapa puas Anda dengan kualitas pelayanan {order.counterparty}? (1 = sangat buruk, 5 = sangat baik)
          </p>
          <div className="mt-3 flex items-center gap-1">
            {STAR_SCORES.map((value) => {
              const selected = score === value;
              const filled = selected;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setScore(value);
                    setFormError(null);
                  }}
                  aria-pressed={selected}
                  aria-label={scoreHint(value)}
                  title={SCORE_HINTS[value]}
                  className={cn(
                    "flex size-11 items-center justify-center border transition-colors duration-300 wesup-ease focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red",
                    selected ? "border-wesup-red text-wesup-red" : "border-wesup-ink/20 text-wesup-ink-sub/40 hover:text-wesup-ink-sub",
                  )}
                >
                  <Star
                    aria-hidden="true"
                    className="size-7"
                    fill={filled ? "currentColor" : "none"}
                    strokeWidth={1.5}
                  />
                </button>
              );
            })}
          </div>
          <p role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">
            {score ? scoreHint(score) : "Belum ada bintang dipilih"}
          </p>
        </fieldset>

        <div>
          <label htmlFor="rating-comment" className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">
            Ulasan untuk {order.counterparty}{" "}
            <span className="normal-case tracking-normal text-wesup-ink-sub/60">(opsional)</span>
          </label>
          <p className="mt-1 text-xs leading-5 text-wesup-ink-sub">
            Ceritakan pengalaman Anda mengenai kualitas produk dan pelayanan di titik kumpul.
          </p>
          <textarea
            id="rating-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={4}
            placeholder="Contoh: barang segar, antrean cepat, dan petugas ramah."
            className="mt-2 w-full border border-wesup-ink/20 bg-wesup-paper px-4 py-2.5 text-sm text-wesup-ink caret-wesup-ink outline-none transition-colors duration-300 wesup-ease placeholder:text-wesup-ink-sub/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
          />
        </div>

        {formError && (
          <p role="alert" className="text-sm font-semibold text-wesup-red">
            {formError}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/pesanan" className={secondaryBtn}>
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.5} />
            Kembali ke Pesanan
          </Link>
          <button type="submit" className={primaryBtn}>
            <ThumbsUp aria-hidden="true" size={16} strokeWidth={1.5} />
            Kirim Penilaian
          </button>
        </div>

        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub/70">
          Penilaian hanya dapat diberikan sekali per transaksi dan tidak dapat diubah setelah dikirim.
        </p>
      </form>
    </div>
  );
}

function OrderHeader({ order }: { order: AccountOrder }) {
  return (
    <div>
      <Link
        href="/pesanan"
        className="inline-flex min-h-11 items-center gap-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-wesup-ink underline decoration-wesup-ink/30 underline-offset-[6px] transition-colors duration-300 hover:decoration-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
      >
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.5} />
        Pesanan
      </Link>
      <header className="mt-4 border-b border-wesup-ink/10 pb-6">
        <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.24em] text-wesup-ink-sub">
          <span aria-hidden="true" className="inline-block h-px w-6 bg-wesup-red" />
          <Star aria-hidden="true" className="size-4 text-wesup-red" strokeWidth={1.5} />
          Penilaian &amp; Ulasan
        </p>
        <h1 className="mt-4 font-landing-display text-3xl uppercase leading-[0.95] tracking-[0.06em] text-wesup-ink">
          {order.batchTitle}
        </h1>
        <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">
          {order.counterparty} · {order.batchDisplayCode} · <span className="tabular-nums">{order.quantity} {order.unit}</span>
        </p>
      </header>
    </div>
  );
}

function AlreadyRatedPanel({
  order,
  score,
  comment,
  createdAt,
}: {
  order: AccountOrder;
  score: RatingScore;
  comment: string | null;
  createdAt: string;
}) {
  return (
    <div className="space-y-6">
      <OrderHeader order={order} />
      <NoticePanel
        tone="success"
        icon={<ThumbsUp aria-hidden="true" className="size-5" strokeWidth={1.5} />}
        title="Penilaian Anda sudah tercatat"
        description="Satu transaksi hanya dapat dinilai satu kali. Berikut ringkasan penilaian yang sudah Anda kirim."
      />
      <section
        aria-label="Ringkasan penilaian Anda"
        className={`${panel} p-5`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1">
            {STAR_SCORES.map((value) => (
              <Star
                key={value}
                aria-hidden="true"
                className={value <= score ? "size-6 text-wesup-red" : "size-6 text-wesup-ink-sub/30"}
                fill={value <= score ? "currentColor" : "none"}
                strokeWidth={1.5}
              />
            ))}
          </div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] tabular-nums text-wesup-ink-sub">
            {dates.format(new Date(createdAt))}
          </p>
        </div>
        {comment && (
          <p className="mt-3 border-l-2 border-wesup-red bg-wesup-paper-sub p-3 text-sm text-wesup-ink">
            {comment}
          </p>
        )}
      </section>
      <Link href="/pesanan" className={secondaryBtn}>
        <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.5} />
        Kembali ke Pesanan
      </Link>
    </div>
  );
}

function NoticePanel({
  tone,
  icon,
  title,
  description,
  action,
}: {
  tone: "info" | "danger" | "success" | "muted";
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  const glyphTone: Record<string, string> = {
    info: "border-wesup-ink/20 text-wesup-ink-sub",
    danger: "border-wesup-red text-wesup-red",
    success: "border-wesup-ink/20 text-wesup-ink",
    muted: "border-wesup-ink/20 text-wesup-ink-sub",
  };
  const ruleTone: Record<string, string> = {
    info: "bg-wesup-ink/25",
    danger: "bg-wesup-red",
    success: "bg-wesup-ink/40",
    muted: "bg-wesup-ink/20",
  };
  return (
    <section className={cn("relative border border-wesup-ink/15 bg-wesup-paper p-5 pl-6")}>
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-0.5", ruleTone[tone])} />
      <div className="flex items-start gap-3">
        <span
          className={cn("flex size-10 shrink-0 items-center justify-center border", glyphTone[tone])}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div>
          <h2 className="font-landing-display text-lg uppercase tracking-[0.05em] text-wesup-ink">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-wesup-ink-sub">{description}</p>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </section>
  );
}
