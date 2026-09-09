"use client";

import { useEffect, useState } from "react";
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
  const { toast } = useToast();

  useEffect(() => {
    async function loadSuppliers() {
      try {
        const res = await fetch("/api/admin/suppliers");
        if (res.ok) {
          const raw = await res.json();
          // Antisipasi berbagai format return API (raw, raw.data, raw.suppliers, dsb)
          const list = Array.isArray(raw) 
            ? raw 
            : Array.isArray(raw.suppliers) 
              ? raw.suppliers 
              : Array.isArray(raw.data) 
                ? raw.data 
                : [];
          setSuppliers(list);
        }
      } catch (err) {
        console.error("Gagal load antrean supplier:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSuppliers();
  }, []);

  async function handleApprove(id: string) {
    const res = await fetch(`/api/admin/suppliers/${id}/approve`, {
      method: "POST",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast(body?.error ?? "Gagal menyetujui Supplier.", "error");
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
      const body = await res.json().catch(() => null);
      toast(body?.error ?? "Gagal menolak Supplier.", "error");
      return;
    }

    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "rejected" } : s))
    );
    toast("Supplier ditolak.", "success");
  }

  return (
    <div className="flex min-h-screen bg-[#f4f2ec]">
      <AdminSidebar />

      <div className="flex flex-1 flex-col">
        <AdminHeader
          title="Antrean Supplier"
          description="Tinjau dan verifikasi pendaftaran Supplier baru"
        />

        <main className="flex-1 px-8 py-6">
          {loading ? (
            <p className="font-mono text-sm text-[#8a8478]">Memuat data antrean...</p>
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