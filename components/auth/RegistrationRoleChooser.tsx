import Link from "next/link";
import { ArrowRight, CheckCircle2, Store, Truck } from "lucide-react";

const roleCards = [
  {
    href: "/register/umkm",
    label: "Daftar sebagai UMKM",
    eyebrow: "Untuk pelaku usaha",
    description:
      "Buat akun langsung aktif untuk melihat batch, bergabung belanja bahan baku, dan mengatur pesanan Anda.",
    note: "Akun langsung aktif",
    Icon: Store,
    iconClass: "bg-blue-50 text-blue-700 ring-blue-100",
    cardClass: "border-blue-200 hover:border-blue-400 hover:bg-blue-50/40",
  },
  {
    href: "/supplier/register",
    label: "Daftar sebagai Supplier",
    eyebrow: "Untuk mitra pemasok",
    description:
      "Tawarkan produk dalam batch volume dan kelola pesanan UMKM setelah data usaha Anda diverifikasi Admin.",
    note: "Membutuhkan verifikasi Admin",
    Icon: Truck,
    iconClass: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    cardClass: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/40",
  },
] as const;

export default function RegistrationRoleChooser() {
  return (
    <section aria-labelledby="registration-role-heading">
      <div className="text-center">
        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
          Mulai di Wesup
        </span>
        <h1
          id="registration-role-heading"
          className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl"
        >
          Pilih jenis akun
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
          Pilih cara Anda beraktivitas di Wesup. Anda hanya perlu satu role untuk memulai.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-2">
        {roleCards.map(({ Icon, ...card }) => (
          <Link
            key={card.href}
            href={card.href}
            aria-label={card.label}
            className={`group flex min-h-64 flex-col rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 sm:p-8 ${card.cardClass}`}
          >
            <div className="flex items-start justify-between gap-4">
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${card.iconClass}`}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <ArrowRight
                className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-700"
                aria-hidden="true"
              />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{card.eyebrow}</p>
            <h2 className="mt-2 text-xl font-extrabold text-slate-950">{card.label}</h2>
            <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{card.description}</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-slate-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              {card.note}
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Sudah punya akun?{" "}
        <Link
          href="/login"
          className="font-bold text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Masuk di sini
        </Link>
      </p>
    </section>
  );
}
