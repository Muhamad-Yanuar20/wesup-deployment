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
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><MapPin className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h2 className="text-base font-bold text-slate-900">Lengkapi profil usaha</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Data ini membantu kami menampilkan batch terdekat dan memastikan layanan self-pickup tetap berada dalam radius {BANDUNG_SERVICE_RADIUS_KM} km Bandung.</p>
          </div>
        </div>

        {loadError ? <Alert tone="error" className="mt-4" action={<button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 font-semibold underline">Coba lagi</button>}>{loadError}</Alert> : null}
        {loading ? <p role="status" className="mt-4 text-sm text-slate-500">Memuat profil usaha...</p> : null}

        <div className="mt-6 grid gap-6">
          <div>
            <label htmlFor="umkm-business-name" className="block text-sm font-semibold text-slate-900">Nama usaha <span aria-hidden="true" className="text-red-600">*</span></label>
            <input id="umkm-business-name" name="businessName" value={values.businessName} onChange={(event) => updateValue("businessName", event.target.value)} required autoComplete="organization" placeholder="Contoh: Warung Budi" className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 caret-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200" aria-invalid={Boolean(fieldErrors.businessName)} aria-describedby={fieldErrors.businessName ? "umkm-business-name-error" : undefined} />
            {fieldErrors.businessName ? <p id="umkm-business-name-error" role="alert" className="mt-1 text-sm text-red-600">{fieldErrors.businessName}</p> : null}
          </div>

          <div>
            <label htmlFor="umkm-business-address" className="block text-sm font-semibold text-slate-900">Alamat usaha <span aria-hidden="true" className="text-red-600">*</span></label>
            <textarea id="umkm-business-address" name="address" value={values.address} onChange={(event) => updateValue("address", event.target.value)} required rows={3} autoComplete="street-address" placeholder="Alamat lengkap usaha" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 caret-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200" aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? "umkm-business-address-error" : undefined} />
            {fieldErrors.address ? <p id="umkm-business-address-error" role="alert" className="mt-1 text-sm text-red-600">{fieldErrors.address}</p> : null}
          </div>

          <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">Pin lokasi usaha <span aria-hidden="true" className="text-red-600">*</span></legend>
            <p className="mt-1 text-xs leading-5 text-slate-600">Lokasi dari pendaftaran sudah ditandai. Anda dapat menggeser peta, memilih titik baru, atau memakai lokasi perangkat.</p>
            <div className="mt-4"><BusinessLocationPickerClient value={values.coordinate} onChange={updateCoordinate} error={fieldErrors.coordinate} label="Lokasi usaha" disabled={loading || saving} /></div>
          </fieldset>
        </div>

        {fieldErrors.form ? <p ref={formErrorRef} tabIndex={-1} role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 outline-none focus-visible:ring-2 focus-visible:ring-red-500">{fieldErrors.form}</p> : null}
        {success ? <p role="status" aria-live="polite" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p> : null}
        <AsyncButton type="submit" pending={saving} pendingLabel="Menyimpan…" disabled={loading || Boolean(loadError)} className="sticky bottom-4 z-10 mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:static sm:w-auto sm:shadow-sm"><Save className="h-4 w-4" aria-hidden="true" />Simpan profil usaha</AsyncButton>
      </section>
    </form>
  );
}
