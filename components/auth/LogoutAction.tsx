"use client";
import { fetchRead, resetReadRequests } from "@/lib/feedback/read-request";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useNavigationSession } from "./NavigationSessionProvider";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";

export function LogoutAction({ className = "inline-flex min-h-11 items-center gap-2  px-4 py-2 text-sm font-semibold text-wesup-ink-sub hover:bg-wesup-paper-sub" }: { className?: string }) {
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState("");
  const locked = useRef(false);
  const router = useRouter();
  const { clearSession } = useNavigationSession();
  async function logout() {
    if (locked.current) return;
    locked.current = true; setPending(true); setError("");
    try {
      // A missing POST response is ambiguous; verify the session rather than repeat the mutation.
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      resetReadRequests();
      const session = await fetchRead("/api/auth/session");
      if (session.status !== 401) throw new Error("unconfirmed");
      clearSession(); setOpen(false); router.replace("/");
    } catch { setError("Belum dapat memastikan Anda sudah keluar. Coba lagi."); }
    finally { locked.current = false; setPending(false); }
  }
  return <><button type="button" className={className} onClick={() => { setError(""); setOpen(true); }}><LogOut aria-hidden="true" className="size-4" />Keluar</button><ConfirmDialog open={open} title="Keluar dari akun?" description="Anda dapat masuk kembali untuk melanjutkan aktivitas." confirmLabel="Keluar" pendingLabel="Sedang keluar…" pending={pending} error={error} onConfirm={() => void logout()} onCancel={() => setOpen(false)} /></>;
}
