"use client";
import Link from "next/link";
import { ErrorState, AsyncButton } from "@/components/feedback";
export default function RouteError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
 return <div className="wesup-app mx-auto max-w-3xl px-4 py-12"><ErrorState title="Halaman ini belum dapat dimuat." description="Coba muat kembali untuk melanjutkan." action={<><AsyncButton onClick={unstable_retry}>Coba lagi</AsyncButton><Link href="/marketplace" className="inline-flex min-h-11 items-center px-4 text-sm font-semibold text-wesup-ink underline decoration-wesup-ink/30 underline-offset-4 transition-colors duration-300 wesup-ease hover:decoration-wesup-red">Kembali ke marketplace</Link></>} /></div>;
}
