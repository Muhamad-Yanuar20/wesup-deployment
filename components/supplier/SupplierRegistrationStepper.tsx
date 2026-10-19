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
      <ol className="grid grid-cols-4">
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
              className="relative flex min-w-0 flex-col items-center"
            >
              {index < SUPPLIER_REGISTRATION_STEPS.length - 1 && (
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
                    ? "border-wesup-ink/20 bg-wesup-ink text-wesup-paper"
                    : current
                      ? "border-wesup-red bg-wesup-red text-wesup-paper"
                      : "border-wesup-ink/20 bg-wesup-paper text-wesup-ink-sub"
                }`}
                aria-hidden="true"
              >
                {complete ? <Check className="h-5 w-5" strokeWidth={1.5} /> : step.id}
              </span>
              <span className="mt-2 max-w-full truncate px-1 text-center text-[10px] font-semibold text-wesup-ink-sub sm:hidden">
                {step.shortLabel}
              </span>
              <span
                className={`mt-2 hidden max-w-full truncate px-1 text-center text-xs font-semibold sm:block ${
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
