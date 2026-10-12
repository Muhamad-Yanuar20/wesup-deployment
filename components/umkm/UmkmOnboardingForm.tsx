"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Save } from "lucide-react";
import BusinessLocationPickerClient from "@/components/maps/BusinessLocationPickerClient";
import type { MapCoordinate } from "@/lib/maps/leaflet-demo";
import { BANDUNG_SERVICE_RADIUS_KM } from "@/lib/geo/service-center";
import { parseUmkmProfilePayload } from "@/lib/umkm/profile-contract";

import { Alert, AsyncButton } from "@/components/feedback";
import { feedbackError, feedbackJson } from "@/lib/feedback/errors";

interface UmkmOnboardingFormProps { returnTo?: string | null; }
interface FormValues { businessName: string; address: string; coordinate: MapCoordinate | null; }
const DEFAULT_VALUES: FormValues = { businessName: "", address: "", coordinate: null };

const inputClass = "mt-2 min-h-11 w-full border border-wesup-ink/20 bg-wesup-paper px-4 text-sm text-wesup-ink caret-wesup-ink outline-none transition-colors duration-300 wesup-ease placeholder:text-wesup-ink-sub/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red";
const labelClass = "block font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub";

function profileToForm(profile: Record<string, unknown> | null | undefined): FormValues {
  if (!profile) return DEFAULT_VALUES;
  const latitude = profile.latitude === null || profile.latitude === undefined ? Number.NaN : typeof profile.latitude === "number" ? profile.latitude : Number(profile.latitude);
  const longitude = profile.longitude === null || profile.longitude === undefined ? Number.NaN : typeof profile.longitude === "number" ? profile.longitude : Number(profile.longitude);
  return {
    businessName: typeof profile.businessName === "string" ? profile.businessName : "",
    address: typeof profile.address === "string" ? profile.address : "",
    coordinate: Number.isFinite(latitude) && Number.isFinite(longitude) ? { lat: latitude, lng: longitude } : null,
  };
}

export default function UmkmOnboardingForm({ returnTo }: UmkmOnboardingFormProps) {
  const router = useRouter();
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const [values, setValues] = useState<FormValues>(DEFAULT_VALUES);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    queueMicrotask(() => { if (!cancelled) { setLoading(true); setLoadError(""); } });
    void fetch("/api/umkm/profile", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await feedbackJson<{profile?: Record<string,unknown>}>(response, "Profil usaha tidak dapat dimuat.");
        if (!cancelled) setValues(profileToForm(body.profile));
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(feedbackError(error, "Profil usaha tidak dapat dimuat."));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [retry]);

  const focusError = () => {
    window.setTimeout(() => formErrorRef.current?.focus(), 0);
  };

  const updateValue = (field: "businessName" | "address", value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "", form: "" }));
    setSuccess("");
  };

  const updateCoordinate = (coordinate: MapCoordinate) => {
    setValues((current) => ({ ...current, coordinate }));
    setFieldErrors((current) => ({ ...current, coordinate: "", form: "" }));
    setSuccess("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess("");
    const parsed = parseUmkmProfilePayload({
      businessName: values.businessName,
      address: values.address,
      latitude: values.coordinate?.lat,
      longitude: values.coordinate?.lng,
    });
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      focusError();
      return;
    }

    setSaving(true);
    setFieldErrors({});
    try {
      const response = await fetch("/api/umkm/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFieldErrors(body.fieldErrors ?? { form: feedbackError(body.error, "Profil usaha belum dapat disimpan.") });
        focusError();
        return;
      }
      setSuccess("Profil usaha berhasil tersimpan.");
      router.replace(returnTo || "/umkm");
      router.refresh();
    } catch {
      setFieldErrors({ form: "Jaringan bermasalah. Coba lagi." });
      focusError();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6 pb-24">
      <section className="border border-wesup-ink/15 bg-wesup-paper p-4 sm:p-6">
        <div className="flex items-start gap-3 border-b border-wesup-ink/10 pb-5">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center border border-wesup-ink/20 bg-wesup-paper-sub text-wesup-red"><MapPin className="size-5" strokeWidth={1.5} /></span>
          <div>
            <h2 className="font-landing-display text-lg uppercase tracking-[0.05em] text-wesup-ink">Lengkapi profil usaha</h2>
            <p className="mt-1 text-sm leading-6 text-wesup-ink-sub">Data ini membantu kami menampilkan batch terdekat dan memastikan layanan self-pickup tetap berada dalam radius <span className="tabular-nums">{BANDUNG_SERVICE_RADIUS_KM}</span> km Bandung.</p>
          </div>
        </div>

        {loadError ? <Alert tone="error" className="mt-5" action={<button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 font-semibold underline">Coba lagi</button>}>{loadError}</Alert> : null}
        {loading ? <p role="status" className="mt-5 font-mono text-xs uppercase tracking-[0.14em] text-wesup-ink-sub">Memuat profil usaha…</p> : null}

        <div className="mt-6 grid gap-6">
          <div>
            <label htmlFor="umkm-business-name" className={labelClass}>Nama usaha <span aria-hidden="true" className="text-wesup-red">*</span></label>
            <input id="umkm-business-name" name="businessName" value={values.businessName} onChange={(event) => updateValue("businessName", event.target.value)} required autoComplete="organization" placeholder="Contoh: Warung Budi" className={inputClass} aria-invalid={Boolean(fieldErrors.businessName)} aria-describedby={fieldErrors.businessName ? "umkm-business-name-error" : undefined} />
            {fieldErrors.businessName ? <p id="umkm-business-name-error" role="alert" className="mt-1 text-sm text-wesup-red">{fieldErrors.businessName}</p> : null}
          </div>

          <div>
            <label htmlFor="umkm-business-address" className={labelClass}>Alamat usaha <span aria-hidden="true" className="text-wesup-red">*</span></label>
            <textarea id="umkm-business-address" name="address" value={values.address} onChange={(event) => updateValue("address", event.target.value)} required rows={3} autoComplete="street-address" placeholder="Alamat lengkap usaha" className={`${inputClass} py-2.5`} aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? "umkm-business-address-error" : undefined} />
            {fieldErrors.address ? <p id="umkm-business-address-error" role="alert" className="mt-1 text-sm text-wesup-red">{fieldErrors.address}</p> : null}
          </div>

          <fieldset className="border border-wesup-ink/15 bg-wesup-paper-sub p-4">
            <legend className="px-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Pin lokasi usaha <span aria-hidden="true" className="text-wesup-red">*</span></legend>
            <p className="mt-1 text-xs leading-5 text-wesup-ink-sub">Lokasi dari pendaftaran sudah ditandai. Anda dapat menggeser peta, memilih titik baru, atau memakai lokasi perangkat.</p>
            <div className="mt-4"><BusinessLocationPickerClient value={values.coordinate} onChange={updateCoordinate} error={fieldErrors.coordinate} label="Lokasi usaha" disabled={loading || saving} /></div>
          </fieldset>
        </div>

        {fieldErrors.form ? <p ref={formErrorRef} tabIndex={-1} role="alert" className="mt-5 border border-wesup-red bg-wesup-paper p-3 text-sm text-wesup-red outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">{fieldErrors.form}</p> : null}
        {success ? <p role="status" aria-live="polite" className="mt-5 border border-wesup-ink/20 bg-wesup-paper-sub p-3 text-sm text-wesup-ink">{success}</p> : null}
        <AsyncButton type="submit" pending={saving} pendingLabel="Menyimpan…" disabled={loading || Boolean(loadError)} className="sticky bottom-4 z-10 mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 border border-wesup-ink bg-wesup-ink px-4 py-3 text-sm font-semibold text-wesup-paper hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0 sm:static sm:w-auto"><Save className="size-4" strokeWidth={1.5} aria-hidden="true" />Simpan profil usaha</AsyncButton>
      </section>
    </form>
  );
}
