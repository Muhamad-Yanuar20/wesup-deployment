import { ReactNode } from "react";

interface EmptyStateProps {
    /** Optional mark to display above the heading */
    illustration?: ReactNode;
    heading: string;
    description?: string;
    /** Optional CTA button */
    action?: ReactNode;
}

export function EmptyState({
    illustration,
    heading,
    description,
    action,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-4 px-5 py-16 text-center">
            <span aria-hidden="true" className="mb-1 block h-px w-10 bg-wesup-red" />
            {illustration ?? <DefaultMark />}

            <div className="space-y-1">
                <h3 className="wesup-state-title text-xl leading-tight text-wesup-ink">{heading}</h3>
                {description && (
                    <p className="max-w-sm text-sm leading-6 text-wesup-ink-sub">{description}</p>
                )}
            </div>

            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

function DefaultMark() {
    return (
        <span
            className="flex size-12 items-center justify-center border border-wesup-ink/20 font-mono text-2xl font-light text-wesup-ink-sub"
            aria-hidden="true"
        >
            +
        </span>
    );
}
