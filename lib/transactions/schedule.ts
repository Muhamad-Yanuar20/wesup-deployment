export interface OfferScheduleInput {
  openingMode: "immediate" | "scheduled";
  scheduledOpensAt?: string;
  collectionDays: number;
  pickupStartsAt: string;
  pickupEndsAt: string;
}

const HOUR = 3_600_000;
export const transactionDates = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
export function formatTransactionDate(value?: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? `${transactionDates.format(new Date(value))} WIB` : "Belum ditentukan";
}
/** datetime-local values in this product always represent WIB, never device time. */
export function fromWibInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+07:00` : value;
}
export function toWibInput(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + 7 * HOUR).toISOString().slice(0, 16) : "";
}

export function validatePickupWindow(start: string, end: string): string | null {
  const a = Date.parse(fromWibInput(start)), b = Date.parse(fromWibInput(end));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "Pilih tanggal dan jam pengambilan.";
  const localStart = new Date(a + 7 * HOUR), localEnd = new Date(b + 7 * HOUR);
  const duration = (b - a) / HOUR;
  if (duration < 4 || duration > 12) return "Pengambilan berlangsung 4–12 jam.";
  if (localStart.toISOString().slice(0, 10) !== localEnd.toISOString().slice(0, 10)
    || localStart.getUTCHours() < 6 || localEnd.getUTCHours() > 22
    || (localEnd.getUTCHours() === 22 && (localEnd.getUTCMinutes() !== 0 || localEnd.getUTCSeconds() !== 0))) {
    return "Pilih jam pada hari yang sama antara 06.00–22.00 WIB.";
  }
  return null;
}

export function buildOfferSchedule(input: OfferScheduleInput, serverNow: string) {
  const now = Date.parse(serverNow);
  const opens = input.openingMode === "immediate" ? now : Date.parse(fromWibInput(input.scheduledOpensAt ?? ""));
  if (!Number.isFinite(now) || !Number.isFinite(opens) || (input.openingMode === "scheduled" && opens <= now)) throw new Error("Waktu buka terjadwal harus di masa depan.");
  if (![1, 2, 3, 7].includes(input.collectionDays)) throw new Error("Pilih lama pengumpulan 1, 2, 3, atau 7 hari.");
  const error = validatePickupWindow(input.pickupStartsAt, input.pickupEndsAt);
  if (error) throw new Error(error);
  const closes = opens + input.collectionDays * 24 * HOUR;
  const payCloses = closes + 24 * HOUR;
  const ready = Date.parse(fromWibInput(input.pickupStartsAt));
  if (ready <= payCloses) throw new Error("Pengambilan harus dimulai setelah masa pembayaran 24 jam berakhir.");
  return {
    registrationOpensAt: new Date(opens).toISOString(), registrationClosesAt: new Date(closes).toISOString(),
    paymentOpensAt: new Date(closes).toISOString(), paymentClosesAt: new Date(payCloses).toISOString(),
    estimatedReadyAt: new Date(ready).toISOString(), pickupEndsAt: new Date(Date.parse(fromWibInput(input.pickupEndsAt))).toISOString(),
  };
}

export function normalizePriceTiers(tiers: readonly { minimumQuantity: number; pricePerUnit: number }[]) {
  if (tiers.length < 2 || tiers[0].minimumQuantity !== 1) throw new Error("Isi harga dasar dan minimal satu harga diskon.");
  return tiers.map((tier, index) => {
    if (!Number.isSafeInteger(tier.minimumQuantity) || tier.minimumQuantity < 1 || !Number.isFinite(tier.pricePerUnit) || tier.pricePerUnit <= 0
      || (index > 0 && (tier.minimumQuantity <= tiers[index - 1].minimumQuantity || tier.pricePerUnit >= tiers[index - 1].pricePerUnit))) {
      throw new Error("Ambang jumlah harus meningkat dan harga diskon harus lebih rendah.");
    }
    return { ...tier, tierNumber: index + 1, maximumQuantity: tiers[index + 1] ? tiers[index + 1].minimumQuantity - 1 : null };
  });
}
