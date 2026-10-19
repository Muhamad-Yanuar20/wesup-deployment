"use client";

import { useNavigationSession } from "@/components/auth/NavigationSessionProvider";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/components/ui/GlobalToast";
import {
  getLoginRoleLabel,
  PUBLIC_LOGIN_ROLES,
  type LoginErrorResponse,
  type LoginFieldErrors,
  type LoginRole,
  type LoginSuccessResponse,
} from "@/lib/auth/login-contract";

import { feedbackError } from "@/lib/feedback/errors";

interface RoleOption {
  value: (typeof PUBLIC_LOGIN_ROLES)[number];
  label: string;
  description: string;
  icon: LucideIcon;
}

const roleOptions: RoleOption[] = [
  {
    value: "umkm",
    label: "UMKM",
    description: "Belanja bahan baku bersama",
    icon: Store,
  },
  {
    value: "supplier",
    label: "Supplier",
    description: "Kelola penawaran dan pesanan",
    icon: Truck,
  },
];

interface LoginFormProps {
  initialRole?: (typeof PUBLIC_LOGIN_ROLES)[number];
  fixedRole?: LoginRole;
  returnTo?: string | null;
}

export default function LoginForm({
  initialRole = "umkm",
  fixedRole,
  returnTo = null,
}: LoginFormProps) {
  const router = useRouter();
  const { refreshSession, applySession } = useNavigationSession();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<LoginRole>(fixedRole ?? initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [globalError, setGlobalError] = useState<string>();
  const selectedRole = fixedRole ?? role;

  function updateEmail(value: string) {
    setEmail(value);
    setFieldErrors((current) => ({ ...current, email: undefined }));
    setGlobalError(undefined);
  }

  function updatePassword(value: string) {
    setPassword(value);
    setFieldErrors((current) => ({ ...current, password: undefined }));
    setGlobalError(undefined);
  }

  function updateRole(value: (typeof PUBLIC_LOGIN_ROLES)[number]) {
    setRole(value);
    setFieldErrors((current) => ({ ...current, role: undefined }));
    setGlobalError(undefined);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFieldErrors({});
    setGlobalError(undefined);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: selectedRole, returnTo }),
      });
      const body = (await response.json()) as Partial<
        LoginSuccessResponse & LoginErrorResponse
      >;

      if (!response.ok) {
        setFieldErrors(body.fieldErrors ?? {});
        setGlobalError(feedbackError(body.error, "Login belum dapat diproses. Coba lagi."));
        return;
      }

      const success = body as LoginSuccessResponse;
      toast(
        `Berhasil masuk sebagai ${getLoginRoleLabel(success.profile.role)}.`,
        "success",
      );
      if (success.accessState) applySession(success.accessState);
      else void refreshSession();
      router.replace(success.redirectTo);

    } catch {
      setGlobalError("Koneksi bermasalah. Periksa internet Anda lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = (field: keyof LoginFieldErrors) =>
    `mt-2 block font-sans normal-case tracking-normal w-full  border px-4 py-3 text-sm text-wesup-ink outline-none transition-colors duration-500 wesup-ease placeholder:text-wesup-ink-sub focus:border-wesup-ink/20   ${
      fieldErrors[field]
        ? "border-wesup-red bg-wesup-paper"
        : "border-wesup-ink/15 bg-wesup-paper"
    }`;

  function fieldError(field: keyof LoginFieldErrors) {
    return fieldErrors[field] ? (
      <p id={`${field}-error`} className="mt-1.5 text-xs font-medium text-wesup-ink" role="alert">
        {fieldErrors[field]}
      </p>
    ) : null;
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6 sm:space-y-7">
      {globalError ? (
        <div
          className="border border-wesup-red bg-wesup-paper px-4 py-3 text-sm font-medium leading-6 text-wesup-ink"
          role="alert"
        >
          {globalError}
        </div>
      ) : null}

      {fixedRole ? (
        <div className="border border-wesup-ink/10 bg-wesup-paper px-4 py-3 text-sm font-semibold text-wesup-ink">
          Login Admin
        </div>
      ) : (
        <fieldset disabled={submitting} className="space-y-3">
          <legend className="text-wesup-ink font-mono text-[0.6875rem] uppercase tracking-[0.18em]">Login sebagai</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {roleOptions.map((option) => {
              const Icon = option.icon;
              const selected = role === option.value;
              return (
                <label
                  key={option.value}
                  className={`relative flex min-h-11 cursor-pointer flex-col  border p-4 transition-colors duration-500 wesup-ease focus-within:ring-2 focus-within:ring-wesup-red ${
                    selected
                      ? "border-wesup-red bg-wesup-paper-sub text-wesup-ink"
                      : "border-wesup-ink/15 bg-wesup-paper text-wesup-ink-sub hover:border-wesup-ink/20 hover:bg-wesup-paper"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={selected}
                    onChange={() => updateRole(option.value)}
                    className="sr-only"
                    aria-describedby="role-description"
                  />
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="mt-3 text-sm font-bold">{option.label}</span>
                  <span className="mt-1 text-xs leading-5 text-wesup-ink-sub">{option.description}</span>
                </label>
              );
            })}
          </div>
          <p id="role-description" className="text-xs text-wesup-ink-sub">Pilih sesuai role akun yang sudah terdaftar di Wesup.</p>
          {fieldError("role")}
        </fieldset>
      )}

      <div>
        <label htmlFor="login-email" className="flex items-center gap-2 text-wesup-ink font-mono text-[0.6875rem] uppercase tracking-[0.18em]">
          <Mail className="h-4 w-4 text-wesup-ink-sub" aria-hidden="true" />
          Email
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => updateEmail(event.target.value)}
          className={inputClass("email")}
          placeholder="alamat@email.com"
          autoComplete="email"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          required
        />
        {fieldError("email")}
      </div>

      <div>
        <label htmlFor="login-password" className="flex items-center gap-2 text-wesup-ink font-mono text-[0.6875rem] uppercase tracking-[0.18em]">
          <LockKeyhole className="h-4 w-4 text-wesup-ink-sub" aria-hidden="true" />
          Password
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => updatePassword(event.target.value)}
            className={`${inputClass("password")} pr-12`}
            placeholder="Masukkan password Anda"
            autoComplete="current-password"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute inset-y-0 right-0 mt-2 flex min-h-11 items-center px-3 text-wesup-ink-sub transition-colors duration-500 wesup-ease hover:text-wesup-ink-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
        {fieldError("password")}
      </div>

      <button
        type="submit"
        disabled={submitting || !selectedRole}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 bg-wesup-ink px-8 py-3.5 text-base font-semibold text-wesup-paper transition-colors duration-500 wesup-ease hover:bg-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        {submitting ? "Sedang masuk…" : "Masuk ke akun"}
      </button>

      <p className="text-center text-sm text-wesup-ink-sub">
        {fixedRole ? (
          <>
            Bukan login Admin?{" "}
            <a href="/login" className="font-semibold text-wesup-ink-sub underline-offset-4 hover:underline">Login UMKM/Supplier</a>
          </>
        ) : (
          <>
            Belum punya akun?{" "}
            <a href="/register" className="font-semibold text-wesup-ink-sub underline-offset-4 hover:underline">Pilih role untuk daftar</a>
          </>
        )}
      </p>
    </form>
  );
}
