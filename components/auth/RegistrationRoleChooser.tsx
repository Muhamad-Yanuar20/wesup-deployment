import Link from "next/link";
import { ArrowRight, Store, Truck } from "lucide-react";

const roleCards = [
  { href: "/register/umkm", label: "Daftar sebagai UMKM", eyebrow: "Untuk pelaku usaha", description: "Buat akun langsung aktif untuk melihat batch, bergabung belanja bahan baku, dan mengatur pesanan Anda.", note: "Akun langsung aktif", Icon: Store },
  { href: "/supplier/register", label: "Daftar sebagai Supplier", eyebrow: "Untuk mitra pemasok", description: "Tawarkan produk dalam batch volume dan kelola pesanan UMKM setelah data usaha Anda diverifikasi Admin.", note: "Membutuhkan verifikasi Admin", Icon: Truck },
] as const;

export default function RegistrationRoleChooser() {
  return <section aria-labelledby="registration-role-heading">
    <div className="mx-auto max-w-3xl text-center">
      <p className="flex items-center justify-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.24em] text-wesup-ink-sub"><span aria-hidden="true" className="h-px w-6 bg-wesup-red" />Mulai di Wesup</p>
      <h1 id="registration-role-heading" className="mt-5 font-landing-display text-3xl font-normal uppercase leading-[1.05] tracking-[0.04em] text-wesup-ink text-balance sm:text-4xl md:text-5xl">Pilih jenis akun</h1>
      <p className="mx-auto mt-5 max-w-xl text-[0.9375rem] leading-7 text-wesup-ink-sub">Pilih cara Anda beraktivitas di Wesup. Anda hanya perlu satu role untuk memulai.</p>
    </div>
    <div className="mt-10 grid gap-5 md:grid-cols-2">
      {roleCards.map(({ Icon, ...card }, index) => <Link key={card.href} href={card.href} aria-label={card.label} className="group border border-wesup-ink/15 bg-wesup-paper-sub p-1.5 transition-colors duration-500 wesup-ease hover:border-wesup-ink/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wesup-red">
        <div className="flex h-full min-h-80 flex-col border border-wesup-ink/10 bg-wesup-paper p-6 sm:p-9">
          <div className="flex items-start justify-between gap-4"><span className="flex size-12 items-center justify-center border border-wesup-ink/20 text-wesup-red"><Icon strokeWidth={1.5} className="size-6" aria-hidden="true" /></span><span className="font-mono text-xs tabular-nums text-wesup-ink-sub">0{index + 1} / AKUN</span></div>
          <p className="mt-7 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-wesup-ink-sub">{card.eyebrow}</p>
          <h2 className="mt-3 font-landing-display text-2xl font-normal uppercase leading-[1.1] tracking-[0.04em] text-wesup-ink sm:text-3xl">{card.label}</h2>
          <p className="mt-4 flex-1 text-[0.9375rem] leading-7 text-wesup-ink-sub">{card.description}</p>
          <span className="mt-7 flex min-h-12 items-center justify-between gap-4 border-t border-wesup-ink/15 pt-4 text-sm font-semibold text-wesup-ink">{card.note}<span className="flex size-9 shrink-0 items-center justify-center border border-wesup-ink/20 transition-transform duration-500 wesup-ease group-hover:translate-x-0.5"><ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" /></span></span>
        </div>
      </Link>)}
    </div>
    <p className="mt-7 text-center text-sm text-wesup-ink-sub">Sudah punya akun? <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-wesup-ink underline decoration-wesup-ink/30 underline-offset-4 transition-colors duration-300 hover:decoration-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">Masuk di sini</Link></p>
  </section>;
}
