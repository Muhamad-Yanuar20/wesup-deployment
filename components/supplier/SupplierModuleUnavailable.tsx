import Link from "next/link";
import { UnavailableState } from "@/components/feedback";
export default function SupplierModuleUnavailable({ title }: { title: string; description: string }) {
 return <div className="wesup-app mx-auto max-w-2xl px-4 py-12"><UnavailableState title={title} description="Fitur ini belum tersedia." action={<Link href="/supplier" className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white">Kembali ke Dashboard Supplier</Link>} /></div>;
}
