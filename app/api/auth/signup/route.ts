import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseUmkmRegistrationPayload } from "@/lib/umkm-registration/contracts";
import {
  isDuplicateUmkmEmailError,
  isUmkmEmailRateLimitError,
  registerUmkm,
  UmkmRegistrationError,
} from "@/lib/umkm-registration/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "signup");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseUmkmRegistrationPayload(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Periksa kembali data pendaftaran.", code: "validation_error", fieldErrors: parsed.fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await registerUmkm(parsed.fields);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isUmkmEmailRateLimitError(error)) {
      return NextResponse.json(
        { error: "Kuota email konfirmasi sedang penuh. Coba lagi nanti.", code: "email_rate_limited" },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
    if (isDuplicateUmkmEmailError(error)) {
      return NextResponse.json(
        { error: "Email ini sudah terdaftar untuk role lain. Silakan masuk menggunakan role akun sebelumnya.", code: "email_registered_other_role", fieldErrors: { email: "Email sudah digunakan." } },
        { status: 409 },
      );
    }
    if (error instanceof UmkmRegistrationError) {
      console.error("[auth/signup] UMKM registration failed", { stage: error.stage, message: error.message });
    } else {
      console.error("[auth/signup] unexpected registration error", error);
    }
    return NextResponse.json(
      { error: "Pendaftaran belum dapat diproses. Coba lagi.", code: "signup_failed" },
      { status: 500 },
    );
  }
}