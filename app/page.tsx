import { connection } from "next/server";
import { HeroScene } from "@/components/landing/scene/HeroScene";
import { SiteHeader } from "@/components/landing/sections/SiteHeader";
import { BatchManifest } from "@/components/landing/sections/BatchManifest";
import { HowItWorks } from "@/components/landing/sections/HowItWorks";
import { Features } from "@/components/landing/sections/Features";
import { ClosingCta } from "@/components/landing/sections/ClosingCta";
import { SiteFooter } from "@/components/landing/sections/SiteFooter";

export default async function Home() {
  // The proxy attaches a `strict-dynamic` + nonce CSP to every public document.
  // Next.js only stamps nonces onto its script tags while rendering per
  // request; a statically prerendered page ships nonce-less tags and is
  // blocked by its own policy. Opting in keeps the landing scene (and every
  // other client interaction) authorized to load.
  await connection();

  return (
    <div className="relative flex min-h-screen flex-col bg-wesup-paper text-wesup-ink antialiased">
      {/* Editorial film grain, fixed and pointer-transparent. */}
      <div aria-hidden="true" className="wesup-grain" />

      <h1 className="sr-only">Wesup — pembelian kolektif bahan baku untuk UMKM Bandung</h1>

      <SiteHeader />

      <main className="flex-1">
        {/* Scroll-scrubbed scene: untouched position, wrapper and props. */}
        <HeroScene />
        <BatchManifest />
        <HowItWorks />
        <Features />
        <ClosingCta />
      </main>

      <SiteFooter />
    </div>
  );
}
