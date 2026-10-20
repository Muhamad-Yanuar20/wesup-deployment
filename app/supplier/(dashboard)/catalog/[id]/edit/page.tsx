import type { Metadata } from "next";
import EditCatalogForm from "@/components/supplier/catalog/EditCatalogForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit Penawaran | Wesup",
  description: "Ubah detail penawaran bahan baku Anda di Wesup.",
};

export default async function EditCatalogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-7 border-b border-wesup-ink/15 pb-7">
        <p className="mb-5 flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.24em] text-wesup-ink-sub">
          <span aria-hidden="true" className="h-px w-6 bg-wesup-red" />
          Wesup / Katalog / Edit
        </p>
        <h1 className="font-landing-display text-3xl font-normal uppercase leading-[1.05] tracking-[0.06em] text-wesup-ink text-balance sm:text-4xl md:text-5xl">
          Edit Penawaran
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-wesup-ink-sub">
          Ubah detail penawaran Anda yang sedang aktif.
        </p>
      </header>
      <EditCatalogForm key={id} />
    </div>
  );
}
