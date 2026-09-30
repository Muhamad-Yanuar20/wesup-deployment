"use client";

import { useEffect, useState, useMemo } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import {
  SupplierQueueTable,
  type SupplierQueueItem,
} from "@/components/admin/SupplierQueueTable";
import { useToast } from "@/components/ui/GlobalToast";

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function loadSuppliers() {
      try {
        const res = await fetch("/api/admin/suppliers", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP Error: ${res.status}`);
        }
        const data = await res.json();


        if (Array.isArray(data)) {
          setSuppliers(data);
        } else {
          setSuppliers([]);
        }
      } catch (err: unknown) {
        console.error("Gagal load antrean supplier:", err);
        setErrorMessage(err instanceof Error ? err.message : "Gagal memuat data dari server");
      } finally {
        setLoading(false);
      }
    }
    loadSuppliers();
  }, []);

  const pendingCount = useMemo(
    () => suppliers.filter((s) => s.status === "pending").length,
    [suppliers]
  );

  async function handleApprove(id: string) {
    const res = await fetch(`/api/admin/suppliers/${id}/approve`, {
      method: "POST",
    });

    if (!res.ok) {
      toast("Gagal menyetujui Supplier.", "error");
      return;
    }

    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "approved" } : s))
    );
    toast("Supplier disetujui.", "success");
  }

  async function handleReject(id: string, reason: string) {
    const res = await fetch(`/api/admin/suppliers/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    if (!res.ok) {
      toast("Gagal menolak Supplier.", "error");
      return;
    }

    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "rejected" } : s))
    );
    toast("Supplier ditolak.", "success");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f2ec]">
      <AdminSidebar pendingSuppliersCount={pendingCount} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader
          title="Antrean Supplier"
          description="Tinjau dan verifikasi pendaftaran Supplier baru"
        />

        <main className="flex-1 overflow-y-auto px-8 py-6">
          {loading ? (
            <p className="font-mono text-sm text-[#8a8478]">Memuat data antrean...</p>
          ) : errorMessage ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <p className="font-semibold">Error Fetch Data:</p>
              <p>{errorMessage}</p>
            </div>
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
