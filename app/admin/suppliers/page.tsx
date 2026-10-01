"use client";

import { useState, useMemo } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import {
  SupplierQueueTable,
  type SupplierQueueItem,
} from "@/components/admin/SupplierQueueTable";
import { useToast } from "@/components/ui/GlobalToast";

import { useFeedbackResource } from "@/lib/feedback/use-resource";
import { ErrorState, ContentSkeleton, AsyncButton } from "@/components/feedback";
import { readFeedbackError } from "@/lib/feedback/errors";

export default function AdminSuppliersPage() {
  const { data, loading, error: errorMessage, reload } = useFeedbackResource<SupplierQueueItem[]>("/api/admin/suppliers", "Antrean supplier belum dapat dimuat.");
  const [decisions, setDecisions] = useState<Record<string, "approved" | "rejected">>({});
  const suppliers = (data ?? []).map(item => decisions[item.id] ? { ...item, status: decisions[item.id] } : item);
  const { toast } = useToast();

  const pendingCount = useMemo(
    () => suppliers.filter((s) => s.status === "pending").length,
    [suppliers]
  );

  async function handleApprove(id: string) {
    const res = await fetch(`/api/admin/suppliers/${id}/approve`, {
      method: "POST",
    });

    if (!res.ok) {
      throw await readFeedbackError(res, "Supplier belum dapat disetujui.");
    }

    setDecisions(current => ({ ...current, [id]: "approved" }));
    toast("Supplier disetujui.", "success");
  }

  async function handleReject(id: string, reason: string) {
    const res = await fetch(`/api/admin/suppliers/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    if (!res.ok) {
      throw await readFeedbackError(res, "Supplier belum dapat ditolak.");
    }

    setDecisions(current => ({ ...current, [id]: "rejected" }));
    toast("Supplier ditolak.", "success");
  }

  return (
    <div className="wesup-app flex h-dvh flex-col md:flex-row overflow-hidden bg-slate-50">
      <AdminSidebar pendingSuppliersCount={pendingCount} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader
          title="Antrean Supplier"
          description="Tinjau dan verifikasi pendaftaran Supplier baru"
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {loading ? (
            <ContentSkeleton variant="table" label="Memuat antrean supplier…" />
          ) : errorMessage ? (
            <ErrorState title="Antrean supplier belum dapat dimuat." description={errorMessage} action={<AsyncButton onClick={() => void reload()}>Coba lagi</AsyncButton>} />
          ) : (
            <SupplierQueueTable
              items={suppliers}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}
        </main>
      </div>
    </div>
  );
}
