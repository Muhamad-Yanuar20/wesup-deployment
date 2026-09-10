import Link from "next/link";
import { Construction } from "lucide-react";

interface SupplierModuleUnavailableProps {
  title: string;
  description: string;
}

export default function SupplierModuleUnavailable({
  title,
  description,
}: SupplierModuleUnavailableProps) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700" aria-hidden="true">
          <Construction className="h-7 w-7" />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Modul Supplier</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{description}</p>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900" role="status">
          Modul ini belum tersedia karena membutuhkan backend operasional nyata. Tidak ada data demo yang ditampilkan.
        </p>
        <Link href="/supplier" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          Kembali ke Dashboard Supplier
        </Link>
      </div>
    </main>
  );
}
