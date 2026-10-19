import SwaggerUiClient from "./SwaggerUiClient";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Wesup API Documentation",
  description: "Dokumentasi API Wesup",
};

export default function DocsPage() {
  return (
    <main
      className="wesup-app docs-paper-shell min-h-dvh px-4 py-8 sm:px-8 sm:py-12"
      style={{ colorScheme: "light" }}
    >
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="mb-6 inline-flex min-h-11 items-center text-sm font-semibold underline decoration-wesup-ink/30 underline-offset-4">← Wesup</Link>
        <PageHeader title="Dokumentasi API" eyebrow="Referensi / Wesup" description="Referensi endpoint, parameter, dan bentuk respons API Wesup." />
        <SwaggerUiClient specUrl="/docs/openapi.json" />
      </div>
    </main>
  );
}
