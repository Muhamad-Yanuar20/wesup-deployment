"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LoaderCircle, MapPinned, Mail, Phone, Store, UserRound } from "lucide-react";
import BusinessLocationPickerClient from "@/components/maps/BusinessLocationPickerClient";
import type { MapCoordinate } from "@/lib/maps/leaflet-demo";
import { SuccessState } from "@/components/feedback";
import { feedbackError } from "@/lib/feedback/errors";

interface SignupFieldErrors {
  full_name?: string;
  phone?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
  location?: string;
}

interface UmkmSignupFormProps {
  returnTo?: string | null;
}

const PHONE_RE = /^\+?[0-9][0-9\s-]{7,19}$/;

type SignupResponse = { error?: string; fieldErrors?: SignupFieldErrors; requiresEmailConfirmation?: boolean };

export default function UmkmSignupForm({ returnTo = null }: UmkmSignupFormProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [coordinate, setCoordinate] = useState<MapCoordinate | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [globalError, setGlobalError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState<boolean | null>(null);

  function validate(): SignupFieldErrors {
    const errors: SignupFieldErrors = {};
    if (fullName.trim().length < 2) errors.full_name = "Nama lengkap wajib diisi.";
    if (!PHONE_RE.test(phone.trim())) errors.phone = "Masukkan nomor WhatsApp yang valid.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "Masukkan alamat email yang valid.";
    if (password.length < 8) errors.password = "Password minimal 8 karakter.";
    if (confirmation !== password) errors.password_confirmation = "Konfirmasi password belum sama.";
    if (!coordinate) errors.location = "Pilih titik lokasi usaha pada peta.";
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const errors = validate();
    setFieldErrors(errors);
    setGlobalError(undefined);
    if (Object.keys(errors).length > 0) { document.getElementById(`umkm-${Object.keys(errors)[0].replaceAll("_", "-")}`)?.focus(); return; }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          password,
          latitude: coordinate?.lat,
          longitude: coordinate?.lng,
        }),
      });
      const body = (await response.json()) as SignupResponse;
      if (!response.ok) {
        setFieldErrors(body.fieldErrors ?? {});
        setGlobalError(feedbackError(body.error, "Pendaftaran belum dapat diproses."));
        return;
      }
      setRegistrationSuccess(Boolean(body.requiresEmailConfirmation));
    } catch {
      setGlobalError("Koneksi bermasalah. Periksa internet Anda lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  const loginHref = returnTo ? `/login?role=umkm&returnTo=${encodeURIComponent(returnTo)}` : "/login?role=umkm";
  const inputClass = (field: keyof SignupFieldErrors) =>
    `mt-2 block font-sans normal-case tracking-normal min-h-11 w-full  border px-4 py-3 text-sm text-wesup-ink outline-none transition-colors duration-500 wesup-ease placeholder:text-wesup-ink-sub focus:border-wesup-ink/20   ${fieldErrors[field] ? "border-wesup-red bg-wesup-paper" : "border-wesup-ink/15 bg-wesup-paper"}`;

  function fieldError(field: keyof SignupFieldErrors) {
    return fieldErrors[field] ? <p id={`${field}-error`} className="mt-1.5 text-xs font-medium text-wesup-ink" role="alert">{fieldErrors[field]}</p> : null;
  }

  if (registrationSuccess !== null) return <SuccessState title="Akun UMKM berhasil dibuat." description={registrationSuccess ? "Periksa email untuk mengonfirmasi akun Anda, lalu masuk untuk melanjutkan." : "Masuk untuk melengkapi profil dan mulai mencari penawaran."} action={<Link href={loginHref} className="inline-flex min-h-11 items-center bg-wesup-ink px-5 py-3 font-semibold text-wesup-paper">Masuk</Link>} />;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 pb-2">
      {globalError ? <div className="border border-wesup-red bg-wesup-paper px-4 py-3 text-sm font-medium leading-6 text-wesup-ink" role="alert">{globalError}</div> : null}

      <div>
        <label htmlFor="umkm-full-name" className="flex items-center gap-2 text-wesup-ink font-mono text-[0.6875rem] uppercase tracking-[0.18em]"><UserRound className="h-4 w-4 text-wesup-ink-sub" aria-hidden="true" />Nama lengkap</label>
        <input id="umkm-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass("full_name")} autoComplete="name" placeholder="Nama Anda" aria-invalid={Boolean(fieldErrors.full_name)} aria-describedby={fieldErrors.full_name ? "full_name-error" : undefined} required />
        {fieldError("full_name")}
      </div>

      <div>
        <label htmlFor="umkm-phone" className="flex items-center gap-2 text-wesup-ink font-mono text-[0.6875rem] uppercase tracking-[0.18em]"><Phone className="h-4 w-4 text-wesup-ink-sub" aria-hidden="true" />Nomor WhatsApp</label>
        <input id="umkm-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass("phone")} autoComplete="tel" placeholder="08xxxxxxxxxx" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "phone-error" : undefined} required />
        {fieldError("phone")}
      </div>

      <div>
        <label htmlFor="umkm-email" className="flex items-center gap-2 text-wesup-ink font-mono text-[0.6875rem] uppercase tracking-[0.18em]"><Mail className="h-4 w-4 text-wesup-ink-sub" aria-hidden="true" />Email</label>
        <input id="umkm-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass("email")} autoComplete="email" placeholder="alamat@email.com" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} required />
        {fieldError("email")}
      </div>

      <div>
        <label htmlFor="umkm-password" className="flex items-center gap-2 text-wesup-ink font-mono text-[0.6875rem] uppercase tracking-[0.18em]"><Store className="h-4 w-4 text-wesup-ink-sub" aria-hidden="true" />Password</label>
        <div className="relative">
          <input id="umkm-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass("password")} pr-12`} autoComplete="new-password" placeholder="Minimal 8 karakter" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "password-error" : undefined} required />
          <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 mt-2 flex min-h-11 items-center px-3 text-wesup-ink-sub hover:text-wesup-ink-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red" aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={showPassword}>{showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}</button>
        </div>
        {fieldError("password")}
      </div>

      <div>
        <label htmlFor="umkm-password-confirmation" className="text-wesup-ink font-mono text-[0.6875rem] uppercase tracking-[0.18em]">Konfirmasi password</label>
        <div className="relative">
          <input id="umkm-password-confirmation" type={showConfirmation ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={`${inputClass("password_confirmation")} pr-12`} autoComplete="new-password" placeholder="Ulangi password" aria-invalid={Boolean(fieldErrors.password_confirmation)} aria-describedby={fieldErrors.password_confirmation ? "password_confirmation-error" : undefined} required />
          <button type="button" onClick={() => setShowConfirmation((visible) => !visible)} className="absolute inset-y-0 right-0 mt-2 flex min-h-11 items-center px-3 text-wesup-ink-sub hover:text-wesup-ink-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red" aria-label={showConfirmation ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"} aria-pressed={showConfirmation}>{showConfirmation ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}</button>
        </div>
        {fieldError("password_confirmation")}
      </div>

      <fieldset className="border border-wesup-ink/10 bg-wesup-paper p-4 sm:p-5">
        <legend className="px-1 text-wesup-ink font-mono text-[0.6875rem] uppercase tracking-[0.18em]"><span className="inline-flex items-center gap-2"><MapPinned className="h-4 w-4 text-wesup-ink-sub" aria-hidden="true" />Lokasi UMKM</span></legend>
        <p className="mt-1 text-sm leading-6 text-wesup-ink-sub">Pilih lokasi usaha Anda agar kami dapat menampilkan batch supplier terdekat. Lokasi wajib berada maksimal 50 km dari pusat layanan Bandung.</p>
        <div className="mt-4">
          <BusinessLocationPickerClient value={coordinate} onChange={setCoordinate} error={fieldErrors.location} label="Lokasi UMKM" />
        </div>
      </fieldset>

      <button type="submit" disabled={submitting} className="inline-flex min-h-11 w-full items-center justify-center gap-2 bg-wesup-ink px-6 py-3.5 text-base font-bold text-wesup-paper transition-colors duration-500 wesup-ease hover:bg-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red disabled:cursor-not-allowed disabled:opacity-60">
        {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-5 w-5" aria-hidden="true" />}
        {submitting ? "Membuat akun…" : "Buat akun UMKM"}
      </button>
      <p className="text-center text-sm text-wesup-ink-sub">Sudah punya akun? <Link href={loginHref} className="font-bold text-wesup-ink-sub underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">Masuk di sini</Link></p>
    </form>
  );
}