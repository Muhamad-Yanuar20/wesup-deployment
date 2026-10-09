interface SectionHeadingProps {
    id?: string;
    eyebrow?: string;
    title: string;
    description?: string;
    align?: "center" | "left";
}

/**
 * Shared section heading for marketing/landing pages.
 */
export function SectionHeading({ id, eyebrow, title, description, align = "center" }: SectionHeadingProps) {
    const alignment = align === "center" ? "text-center mx-auto" : "text-left";
    return (
        <div id={id} className={`max-w-3xl ${alignment} mb-12 md:mb-16 scroll-mt-24`}>
            {eyebrow ? (
                <p className="mb-4 inline-flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.24em] text-wesup-ink-sub">
                    <span aria-hidden="true" className="inline-block h-px w-6 bg-wesup-red" />
                    {eyebrow}
                </p>
            ) : null}
            <h2 className="font-landing-display text-3xl leading-[0.95] tracking-[0.08em] uppercase text-wesup-ink sm:text-5xl md:text-6xl text-balance">
                {title}
            </h2>
            {description ? (
                <p className="mt-4 text-base leading-[1.7] text-wesup-ink-sub text-pretty max-w-2xl">
                    {description}
                </p>
            ) : null}
        </div>
    );
}
