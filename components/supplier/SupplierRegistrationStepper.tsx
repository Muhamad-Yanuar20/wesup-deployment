import { Check } from "lucide-react";
import {
  SUPPLIER_REGISTRATION_STEPS,
  type SupplierRegistrationStep,
} from "@/lib/supplier-registration/steps";

export default function SupplierRegistrationStepper({
  currentStep,
}: {
  currentStep: SupplierRegistrationStep;
}) {
  const currentLabel = SUPPLIER_REGISTRATION_STEPS[currentStep - 1].label;

  return (
    <nav aria-label="Progress pendaftaran pemasok">
      <ol className="grid grid-cols-4 border border-wesup-ink/15 bg-wesup-paper-sub p-1.5">
        {SUPPLIER_REGISTRATION_STEPS.map((step, index) => {
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
              className={`relative flex min-w-0 flex-col items-center border-r border-wesup-ink/10 px-1 py-5 last:border-r-0 ${current ? "bg-wesup-paper" : ""}`}
            >
              {index < SUPPLIER_REGISTRATION_STEPS.length - 1 && (
                <span
                  className={`absolute left-1/2 top-10 h-px w-full ${
                    complete ? "bg-wesup-ink" : "bg-wesup-paper-sub"
                  }`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 flex h-10 w-10 items-center justify-center  border text-sm font-bold transition-colors ${
                  complete
                    ? "border-wesup-ink/20 bg-wesup-ink text-wesup-paper"
                    : current
                      ? "border-wesup-red bg-wesup-red text-wesup-paper"
                      : "border-wesup-ink/20 bg-wesup-paper text-wesup-ink-sub"
                }`}
                aria-hidden="true"
              >
                {complete ? <Check className="h-5 w-5" strokeWidth={1.5} /> : step.id}
              </span>
              <span className="mt-3 max-w-full px-1 text-center font-mono text-[9px] uppercase leading-4 text-wesup-ink-sub sm:hidden">
                {step.shortLabel}
              </span>
              <span
                className={`mt-3 hidden max-w-full px-1 text-center font-mono text-[0.6875rem] uppercase tracking-[0.12em] sm:block ${
                  current || complete ? "text-wesup-ink-sub" : "text-wesup-ink-sub"
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
        Langkah {currentStep} dari 4: {currentLabel}
      </p>
    </nav>
  );
}
