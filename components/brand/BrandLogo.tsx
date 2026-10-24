import Image from "next/image";

/** Shared official brand mark. The wordmark stays readable at navigation sizes. */
export function BrandLogo({ className = "", inverted = false, admin = false }: {
  className?: string;
  inverted?: boolean;
  admin?: boolean;
}) {
  return <span className={`inline-flex shrink-0 items-center gap-2.5 ${className}`}>
    <span className="flex size-11 shrink-0 items-center justify-center">
      <Image src="/brand/wesup-logo.png" alt="" width={44} height={44} sizes="44px" className="size-11 object-contain" />
    </span>
    <span className={`font-landing-display text-xl tracking-[-0.02em] ${inverted ? "text-wesup-paper" : "text-wesup-ink"}`}>Wesup{admin && <span className="ml-1.5 font-sans text-sm font-normal">Admin</span>}</span>
  </span>;
}
