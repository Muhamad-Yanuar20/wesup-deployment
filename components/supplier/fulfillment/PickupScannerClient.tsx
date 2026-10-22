"use client";

import Link, { FulfillmentBackLink } from "./FulfillmentLink";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  Truck,
  Users,
} from "lucide-react";
import { supplierFulfillmentApiRepository } from "@/lib/supplier-fulfillment/api-repository";
import { supplierBatchApiRepository } from "@/lib/supplier-catalog/api-repository";
import { pickupViewReducer, initialPickupViewState } from "@/lib/supplier-fulfillment/pickup-state";
import { feedbackError } from "@/lib/feedback/errors";
import PickupCamera from "./PickupCamera";
import { decodePickupQr } from "@/lib/supplier-fulfillment/qr-payload";
import ForceMajeureDialog from "@/components/supplier/fulfillment/ForceMajeureDialog";
import { Skeleton } from "@/components/ui/SkeletonLoading";

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const abort = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";
const message = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export default function PickupScannerClient({ batchId }: { batchId: string }) {
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(pickupViewReducer, initialPickupViewState);
  const [retry, setRetry] = useState(0);
  const [batchTitle, setBatchTitle] = useState<string>("batch ini");
  const confirming = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const forceMajeureRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void supplierBatchApiRepository
      .getById(batchId, { signal: controller.signal })
      .then((batch) => {
        if (batch) setBatchTitle(batch.title);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [batchId]);

  const preselectedReg =
    typeof window === "undefined" ? null : searchParams.get("reg");

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "loadStarted" });
    void supplierFulfillmentApiRepository
      .listOrders(batchId, { signal: controller.signal })
      .then((list) => dispatch({ type: "loadSucceeded", orders: [...list.orders] }))
      .catch((error: unknown) => {
        if (!abort(error)) {
          dispatch({
            type: "loadFailed",
            message: message(error, "Gagal memuat pesanan."),
          });
        }
      });
    return () => controller.abort();
  }, [batchId, retry]);

  // Apply the preselected registration once orders have loaded.
  useEffect(() => {
    if (
      state.loadPhase === "success" &&
      preselectedReg &&
      state.orders.some((o) => o.registrationId === preselectedReg)
    ) {
      dispatch({ type: "selectOrder", registrationId: preselectedReg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loadPhase, preselectedReg]);

  const selectedOrder = useMemo(
    () =>
      state.orders.find(
        (o) => o.registrationId === state.selectedRegistrationId,
      ) ?? null,
    [state.orders, state.selectedRegistrationId],
  );

  const paidOrders = useMemo(
    () => state.orders.filter((o) => o.status === "paid" && o.canConfirmPickup !== false),
    [state.orders],
  );

  const acceptQr = (raw: string) => {
    try {
      const decoded = decodePickupQr(raw);
      const id = decoded.registrationId ?? state.selectedRegistrationId;
      if (!id) throw new Error("QR lama: pilih pesanan UMKM terlebih dahulu.");
      const order = state.orders.find(order => order.registrationId === id);
      if (!order) throw new Error("QR ini bukan pesanan pada batch yang sedang dibuka.");
      if (order.status !== "paid" || order.canConfirmPickup === false) throw new Error("Pesanan ini belum dapat diserahkan atau sudah diambil.");
      dispatch({ type: "selectOrder", registrationId: id });
      dispatch({ type: "codeChanged", code: decoded.token });
    } catch (reason) { dispatch({ type: "codeChanged", code: "" }); dispatch({ type: "confirmFailed", error: { code: "invalid_code", message: message(reason, "QR tidak valid.") } }); }
  };
  const checkStatus = async (id: string, method: "qr" | "pin") => {
    const list = await supplierFulfillmentApiRepository.listOrders(batchId);
    const order = list.orders.find(order => order.registrationId === id);
    dispatch({ type: "loadSucceeded", orders: [...list.orders] });
    if (order && ["picked_up", "completed"].includes(order.status)) {
      setUncertain(false); dispatch({ type: "confirmSucceeded", order: { ...order, pickedUpByMethod: method } }); return true;
    }
    setUncertain(false); return false;
  };
  const confirmPickup = async () => {
    if (!selectedOrder || selectedOrder.status !== "paid" || selectedOrder.canConfirmPickup === false || confirming.current || uncertain) return;
    if (!state.code.trim() || (state.method === "pin" && !/^\d{4}$/.test(state.code))) {
      dispatch({ type: "confirmFailed", error: { code: "invalid_code", message: "Masukkan QR atau PIN 4 digit yang benar." } }); return;
    }
    confirming.current = true; dispatch({ type: "confirmStarted" });
    try {
      await supplierFulfillmentApiRepository.confirmPickup(selectedOrder.registrationId, { method: state.method, code: state.code });
      if (!await checkStatus(selectedOrder.registrationId, state.method)) throw new Error("Status server belum mengonfirmasi pengambilan.");
    } catch (reason) {
      setUncertain(true);
      dispatch({ type: "confirmFailed", error: { code: "not_eligible", message: feedbackError(reason, "Hasil serah terima belum terkonfirmasi. Periksa status pesanan sebelum mengirim ulang.") } });
      try { await checkStatus(selectedOrder.registrationId, state.method); } catch { /* Explicit read retry remains available; never retry the mutation. */ }
    } finally { confirming.current = false; }
  };
  const confirmForceMajeure = () => {
    if (state.forceMajeurePhase === "loading") return;
    dispatch({ type: "forceMajeureStarted" });
    void supplierFulfillmentApiRepository.forceMajeureCancel(batchId)
      .then(result => dispatch({ type: "forceMajeureSucceeded", result }))
      .catch((error: unknown) => { if (!abort(error)) dispatch({ type: "forceMajeureFailed", message: feedbackError(error, "Pembatalan belum terkonfirmasi. Periksa status pesanan sebelum mencoba lagi.") }); });
  };

  if (state.loadPhase === "idle" || state.loadPhase === "loading") {
    return (
      <div className="space-y-4">
        <BackLink batchId={batchId} />
        <Skeleton className="mb-4 h-9 w-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 " />
          <Skeleton className="h-72 " />
        </div>
      </div>
    );
  }

  if (state.loadPhase === "error") {
    return (
      <div className="space-y-4">
        <BackLink batchId={batchId} />
        <section className="flex flex-col items-center justify-center gap-3  border border-wesup-red/40 bg-wesup-paper p-10 text-center ">
          <AlertCircle aria-hidden="true" size={40} className="text-wesup-red/70" />
          <div>
            <h2 className="text-lg font-bold text-wesup-ink">Tidak dapat dimuat</h2>
            <p className="mt-1 text-sm text-wesup-red">{state.loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => setRetry((v) => v + 1)}
            className="inline-flex items-center gap-2  bg-wesup-ink px-4 py-2 text-sm font-semibold text-wesup-paper hover:bg-wesup-red"
          >
            <RefreshCw aria-hidden="true" size={16} />
            Muat Ulang
          </button>
        </section>
      </div>
    );
  }

  const fmError = state.forceMajeureError;
  const pickedUpCount = state.orders.filter((o) => o.status === "picked_up").length;

  return (
    <div className="space-y-6">
      <BackLink batchId={batchId} />

      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-wesup-ink sm:text-3xl">
            <ScanLine aria-hidden="true" size={26} className="text-wesup-red" />
            Serah Terima
          </h1>
          <p className="mt-2 text-sm font-semibold text-wesup-ink">{batchTitle}</p>
          <p className="mt-1 text-sm text-wesup-ink-sub">
            Validasi pengambilan barang oleh UMKM (pindai QR atau masukkan PIN).
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/supplier/batch/${batchId}/orders`}
            className="inline-flex items-center justify-center gap-2  border border-wesup-ink/15 bg-wesup-paper px-4 py-3 text-sm font-semibold text-wesup-ink transition hover:border-wesup-red hover:text-wesup-ink"
          >
            <ClipboardList aria-hidden="true" size={18} />
            Manajemen Pesanan
          </Link>
          <Link
            href={`/supplier/batch/${batchId}`}
            className="inline-flex items-center justify-center gap-2  border border-wesup-ink/15 bg-wesup-paper px-4 py-3 text-sm font-semibold text-wesup-ink transition hover:border-wesup-red hover:text-wesup-ink"
          >
            <Truck aria-hidden="true" size={18} />
            Detail Batch
          </Link>
        </div>
      </section>

      {/* Escrow / readiness info */}
      <section className=" border border-wesup-ink/15 bg-wesup-paper-sub p-4 text-sm text-wesup-ink">
        <p className="font-semibold">Petunjuk serah terima</p>
        <ul className="mt-1 list-inside list-disc space-y-1 text-wesup-ink-sub">
          <li>
            Hanya pesanan berstatus <strong>Lunas</strong> yang dapat diverifikasi.
          </li>
          <li>
            Berhasil dipindai akan menandai pesanan{" "}
            <strong>Sudah Diambil</strong> dan memulai hitung mundur escrow 1×24 jam.
          </li>
          <li>
              Layani pengambilan sesuai rentang waktu yang tercantum pada detail batch.
          </li>
        </ul>
      </section>

      {/* Summary strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummaryCard
          icon={<Users className="text-wesup-red" size={20} />}
          iconBg="bg-wesup-paper-sub"
          label="Lunas"
          value={String(paidOrders.length)}
        />
        <SummaryCard
          icon={<CheckCircle2 className="" size={20} />}
          iconBg=""
          label="Sudah Diambil"
          value={String(pickedUpCount)}
        />
        <SummaryCard
          icon={<Truck className="text-wesup-red" size={20} />}
          iconBg="bg-wesup-paper-sub"
          label="Total Pesanan"
          value={String(state.orders.length)}
        />
      </section>

      {/* Order selector + scanner */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Order selection */}
        <div className=" border border-wesup-ink/15 bg-wesup-paper p-5 ">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-wesup-ink">
            <Users aria-hidden="true" size={18} className="text-wesup-red" />
            Pilih Pesanan UMKM
          </h2>
          {state.orders.length === 0 ? (
            <p className="text-sm text-wesup-ink-sub">
              Belum ada pesanan pada batch ini.
            </p>
          ) : (
            <div className="space-y-2">
              <label htmlFor="pickup-order" className="sr-only">
                Pilih pesanan
              </label>
              <select
                id="pickup-order"
                value={selectedOrder?.registrationId ?? ""}
                disabled={state.confirmPhase === "loading" || uncertain}
                onChange={(e) =>
                  dispatch({
                    type: "selectOrder",
                    registrationId: e.target.value || null,
                  })
                }
                className="min-h-11 w-full border border-wesup-ink/15 bg-wesup-paper px-3 py-2 text-sm outline-none focus:border-wesup-red focus:ring-2 "
              >
                <option value="">— Pilih pesanan —</option>
                {state.orders.map((order) => (
                  <option key={order.registrationId} value={order.registrationId}>
                    {order.umkmName} · {order.displayCode} · {statusLabel(order.status)}
                  </option>
                ))}
              </select>

              {selectedOrder ? (
                <div className="mt-3  border border-wesup-ink/15 bg-wesup-paper p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-wesup-ink">
                      {selectedOrder.umkmName}
                    </p>
                    <StatusBadge status={selectedOrder.status} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-wesup-ink-sub">
                    {selectedOrder.displayCode}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-wesup-ink-sub">
                    <div className="flex justify-between">
                      <dt>Kuantitas</dt>
                      <dd className="font-semibold text-wesup-ink">
                        {selectedOrder.quantity} {selectedOrder.unit}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Tier</dt>
                      <dd className="font-semibold text-wesup-ink">
                        {selectedOrder.lockedTier ? `Tier ${selectedOrder.lockedTier}` : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Daftar</dt>
                      <dd className="font-semibold text-wesup-ink">
                        {dates.format(new Date(selectedOrder.createdAt))}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="mt-2 text-xs text-wesup-ink-sub">
                  Pilih pesanan UMKM untuk mulai verifikasi.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Scanner / PIN */}
        <div className=" border border-wesup-ink/15 bg-wesup-paper p-5 ">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-wesup-ink">
            {state.method === "qr" ? (
              <QrCode aria-hidden="true" size={18} className="text-wesup-red" />
            ) : (
              <KeyRound aria-hidden="true" size={18} className="text-wesup-red" />
            )}
            Verifikasi Kode
          </h2>

          {/* Method toggle */}
          <div className="grid grid-cols-2 gap-1  border border-wesup-ink/15 bg-wesup-paper p-1">
            <button
              type="button"
              onClick={() => dispatch({ type: "methodChanged", method: "qr" })}
              disabled={state.confirmPhase === "loading" || uncertain}
              aria-pressed={state.method === "qr"}
              className={`inline-flex min-h-11 items-center justify-center gap-1.5  px-3 py-2 text-sm font-semibold transition ${
                state.method === "qr"
                  ? "bg-wesup-paper text-wesup-ink "
                  : "text-wesup-ink-sub hover:bg-wesup-paper-sub"
              }`}
            >
              <QrCode aria-hidden="true" size={16} />
              Pindai QR
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "methodChanged", method: "pin" })}
              disabled={state.confirmPhase === "loading" || uncertain}
              aria-pressed={state.method === "pin"}
              className={`inline-flex min-h-11 items-center justify-center gap-1.5  px-3 py-2 text-sm font-semibold transition ${
                state.method === "pin"
                  ? "bg-wesup-paper text-wesup-ink "
                  : "text-wesup-ink-sub hover:bg-wesup-paper-sub"
              }`}
            >
              <KeyRound aria-hidden="true" size={16} />
              PIN 4-digit
            </button>
          </div>

          {state.method === "qr" ? (
            <div className="mt-4">
              <PickupCamera onRead={acceptQr} resetKey={`${batchId}:${state.selectedRegistrationId}:${state.method}:${state.confirmPhase}`} disabled={state.confirmPhase === "loading" || uncertain} />
              <label htmlFor="qr-code" className="mt-4 block text-sm font-semibold ">
                Kode QR / hasil pindai
              </label>
              <input
                id="qr-code"
                type="text"
                value={state.code}
                onChange={(e) => dispatch({ type: "codeChanged", code: e.target.value })}
                onBlur={(e) => { if (e.target.value.trim()) acceptQr(e.target.value); }}
                placeholder="Tempel atau ketik kode QR"
                autoComplete="off"
                className="mt-2 min-h-11 w-full border border-wesup-ink/15 px-3 py-2 font-mono text-sm outline-none focus:border-wesup-red focus:ring-2 "
              />
            </div>
          ) : (
            <div className="mt-4">
              <label htmlFor="pin-code" className="block text-sm font-semibold ">
                PIN 4-digit UMKM
              </label>
              <input
                id="pin-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={state.code}
                onChange={(e) =>
                  dispatch({ type: "codeChanged", code: e.target.value.replace(/\D/g, "") })
                }
                placeholder="••••"
                autoComplete="off"
                className="mt-2 min-h-11 w-full border border-wesup-ink/15 px-3 py-2 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:border-wesup-red focus:ring-2 "
              />
              <p className="mt-2 text-xs text-wesup-ink-sub">
                Cadangan operasional jika kamera tidak dapat digunakan.
              </p>
            </div>
          )}

          {uncertain && selectedOrder && <button type="button" className="mt-3 min-h-11 border border-wesup-ink px-3 text-sm font-semibold" onClick={() => void checkStatus(selectedOrder.registrationId, state.method).catch(() => {})}>Periksa status pengambilan</button>}
          {state.confirmError ? (
            <p role="alert" aria-live="assertive" className="mt-3  border border-wesup-red/40 bg-wesup-paper px-3 py-2 text-sm text-wesup-red">
              {state.confirmError.message}
            </p>
          ) : null}

          <button
            type="button"
            disabled={uncertain || !selectedOrder || selectedOrder.canConfirmPickup === false || state.confirmPhase === "loading" || selectedOrder.status !== "paid"}
            onClick={() => void confirmPickup()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2  bg-wesup-ink px-5 py-3 text-sm font-semibold text-wesup-paper  transition hover:bg-wesup-red disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.confirmPhase === "loading" ? (
              <>
                <RefreshCw aria-hidden="true" size={18} className="animate-spin" />
                Memvalidasi…
              </>
            ) : (
              <>
                <CheckCircle2 aria-hidden="true" size={18} />
                Konfirmasi Pengambilan
              </>
            )}
          </button>

          {selectedOrder && selectedOrder.status !== "paid" && !state.resultOrder && (
            <p className="mt-2 text-xs ">
              Pesanan berstatus {statusLabel(selectedOrder.status)} belum dapat diverifikasi.
            </p>
          )}
        </div>
      </section>

      {/* Success result banner */}
      {state.resultOrder && (
        <section
          role="status"
          aria-live="polite"
          className=" border   p-5 "
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 aria-hidden="true" size={24} className="mt-0.5 shrink-0 " />
            <div>
              <h3 className="font-bold">Serah terima berhasil</h3>
              <p className="mt-1 text-sm">
                Pesanan{" "}
                <span className="font-semibold">{state.resultOrder.umkmName}</span> (
                {state.resultOrder.displayCode}) ditandai{" "}
                <strong>Sudah Diambil</strong> via{" "}
                {state.resultOrder.pickedUpByMethod === "qr" ? "pindai QR" : "PIN"}.
              </p>
              <p className="mt-1 text-sm">
                Hitung mundur escrow <strong>1×24 jam</strong> telah dimulai.
              </p>
              <button
                type="button"
                onClick={() => dispatch({ type: "resetResult" })}
                className="mt-3 inline-flex items-center gap-1  border  bg-wesup-paper px-3 py-1.5 text-xs font-semibold text-wesup-ink transition hover:"
              >
                <RefreshCw aria-hidden="true" size={14} />
                Verifikasi pesanan lain
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Force Majeure */}
      <section className=" border border-wesup-red/40 bg-wesup-paper p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-wesup-red">
              <ShieldAlert aria-hidden="true" size={18} />
              Pembatalan Darurat (Force Majeure)
            </h3>
            <p className="mt-1 text-sm text-wesup-red">
              Batalkan seluruh batch karena kondisi di luar kendali (barang rusak, bencana).
              Pesanan lunas masuk antrean Full Refund; UMKM tidak dikenakan sanksi No-Show.
            </p>
          </div>
          <button
            ref={forceMajeureRef}
            type="button"
            onClick={() => dispatch({ type: "forceMajeureOpened" })}
            className="inline-flex shrink-0 items-center justify-center gap-2  border  bg-wesup-paper px-4 py-2.5 text-sm font-semibold text-wesup-red transition hover:bg-wesup-red/10"
          >
            <ShieldAlert aria-hidden="true" size={16} />
            Instruksi Darurat
          </button>
        </div>
        {state.forceMajeureResult && (
          <p role="status" aria-live="polite" className="mt-3  border border-wesup-red/40 bg-wesup-paper px-3 py-2 text-sm text-wesup-red">
            Batch dibatalkan pada {dates.format(new Date(state.forceMajeureResult.cancelledAt))}.{" "}
            {state.forceMajeureResult.refundedOrderCount > 0
              ? `${state.forceMajeureResult.refundedOrderCount} pesanan lunas masuk antrean refund.`
              : "Belum ada pesanan lunas untuk direfund."}
          </p>
        )}
        {fmError && (
          <p role="alert" aria-live="assertive" className="mt-3 text-sm text-wesup-red">
            {fmError}
          </p>
        )}
      </section>

      <ForceMajeureDialog
        open={state.forceMajeureOpen}
        batchTitle={batchTitle}
        paidOrderCount={paidOrders.length}
        phase={state.forceMajeurePhase}
        error={state.forceMajeureError}
        onCancel={() => dispatch({ type: "forceMajeureClosed" })}
        onConfirm={confirmForceMajeure}
        returnFocusRef={forceMajeureRef}
      />
    </div>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    registered: "Terdaftar",
    pending_payment: "Menunggu Bayar",
    paid: "Lunas",
    picked_up: "Sudah Diambil",
    no_show: "Tidak Hadir",
    cancelled: "Dibatalkan",
  };
  return map[status] ?? status;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    registered: "bg-wesup-paper-sub text-wesup-ink",
    pending_payment: " ",
    paid: "bg-wesup-paper-sub text-wesup-ink",
    picked_up: " text-wesup-ink",
    no_show: "bg-wesup-red/10 text-wesup-red",
    cancelled: "bg-wesup-paper-sub text-wesup-ink-sub",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5  px-2.5 py-1 text-xs font-semibold ${
        styles[status] ?? "bg-wesup-paper-sub text-wesup-ink"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

function BackLink({ batchId }: { batchId: string }) { return <FulfillmentBackLink batchId={batchId} page="pickup" />; }

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
    <div className=" border border-wesup-ink/15 bg-wesup-paper p-4 ">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center  ${iconBg}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-wesup-ink-sub">{label}</p>
          <p className="truncate text-lg font-bold text-wesup-ink">{value}</p>
        </div>
      </div>
    </div>
  );
}
