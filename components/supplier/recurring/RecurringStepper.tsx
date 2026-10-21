"use client";

import { Check } from "lucide-react";
import {
  RECURRING_STEPS,
  type RecurringDraftStep,
} from "@/lib/supplier-recurring/types";

export default function RecurringStepper({
  currentStep,
}: {
  currentStep: RecurringDraftStep;
}) {
  const currentLabel = RECURRING_STEPS[currentStep - 1].label;

  return (
    <nav aria-label="Progress pembuatan jadwal">
      <ol className="grid grid-cols-3">
        {RECURRING_STEPS.map((step, index) => {
          const complete = step.id < currentStep;
          const current = step.id === currentStep;
          const status = complete
            ? "Selesai"
            : current
              ? "Langkah aktif"
              : "Belum dimulai";

          return (
            <li
              key={step.id}
              aria-current={current ? "step" : undefined}
              className="relative flex min-w-0 flex-col items-center"
            >
              {index < RECURRING_STEPS.length - 1 && (
                <span
                  className={`absolute left-1/2 top-5 h-px w-full ${
                    complete ? "bg-wesup-ink" : "bg-wesup-paper-sub"
                  }`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 flex h-10 w-10 items-center justify-center  border text-sm font-bold transition-colors ${
                  complete
                    ? "border-wesup-ink/20 600 bg-wesup-ink text-wesup-paper"
                    : current
                      ? "border-wesup-ink/20 600 bg-wesup-ink text-wesup-paper ring-4 wesup-ink"
                      : "border-wesup-ink/15 bg-wesup-paper text-wesup-ink-sub"
                }`}
                aria-hidden="true"
              >
                {complete ? (
                  <Check className="h-5 w-5" strokeWidth={2.5} />
                ) : (
                  step.id
                )}
              </span>
              <span className="mt-2 max-w-full truncate px-1 text-center text-[10px] font-semibold text-wesup-ink-sub sm:hidden">
                {step.shortLabel}
              </span>
              <span
                className={`mt-2 hidden max-w-full truncate px-1 text-center text-xs font-semibold sm:block ${
                  current || complete ? "text-wesup-ink" : "text-wesup-ink-sub"
                }`}
              >
                {step.label}
              </span>
              <span className="sr-only">
                {step.label}: {status}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        Langkah {currentStep} dari 3: {currentLabel}
      </p>
    </nav>
  );
}
