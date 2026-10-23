import Link from "next/link";
import { UnavailableState } from "@/components/feedback";
import { AppPanel } from "@/components/layout/AppPanel";
export default function SupplierModuleUnavailable({ title, description }: { title: string; description: string }) {
 return <div className="wesup-app mx-auto max-w-2xl px-4 py-12"><AppPanel><UnavailableState embedded title={title} description={description} action={<Link href="/supplier" className="inline-flex min-h-11 items-center border border-wesup-ink bg-wesup-ink px-5 py-3 text-sm font-semibold text-wesup-paper transition-colors duration-500 wesup-ease hover:bg-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">Kembali ke Dashboard Supplier</Link>} /></AppPanel></div>;
}
