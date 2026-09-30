import type { VerificationStatus } from "@/types/database";

export type SupplierStatusTone = "pending" | "rejected" | "approved";

export interface SupplierStatusView {
  tone: SupplierStatusTone;
  title: string;
  description: string;
  reason: string | null;
  readOnly: boolean;
  nextPath: "/supplier/status" | "/supplier";
}

export function getSupplierStatusView(
  status: VerificationStatus,
  notes: string | null | undefined,
): SupplierStatusView {
  if (status === "approved") {
    return {
      tone: "approved",
      title: "Supplier disetujui",
      description: "Akun Anda sudah aktif. Kelola katalog dan pesanan dari dashboard Supplier.",
      reason: null,
      readOnly: false,
      nextPath: "/supplier",
    };
  }

  if (status === "rejected") {
    return {
      tone: "rejected",
      title: "Pendaftaran belum disetujui",
      description: "Data pendaftaran Anda perlu diperbaiki atau dikonfirmasi kembali oleh Admin Wesup.",
      reason: notes?.trim() || null,
      readOnly: true,
      nextPath: "/supplier/status",
    };
  }

  return {
    tone: "pending",
    title: "Pendaftaran sedang diverifikasi",
    description: "Admin Wesup sedang memeriksa data usaha dan foto yang Anda kirim. Selama proses ini, akun bersifat read-only.",
    reason: null,
    readOnly: true,
    nextPath: "/supplier/status",
  };
}
