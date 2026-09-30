import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAccountStatusMessage,
  getRoleMismatchMessage,
  LOGIN_REDIRECT_BY_ROLE,
  parseLoginPayload,
} from "@/lib/auth/login-contract";
import { sanitizeReturnTo } from "@/lib/auth/access-state";
import { getCurrentUser, maybeLiftExpiredTemporarySuspension } from "@/lib/supabase/auth";
import type { AuthClient, RpcLiftClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import type { VerificationStatus } from "@/types/database";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "login");
  if (limited) return limited;

  const client = await getServerClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseLoginPayload(body);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: "Periksa kembali data login Anda.",
        fieldErrors: parsed.fieldErrors,
      },
      { status: 400 },
    );
  }

  const { email, password, role: selectedRole, returnTo } = parsed.value;
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json(
      { code: "invalid_credentials", error: "Email atau password salah." },
      { status: 401 },
    );
  }

  let context;
  try {
    context = await getCurrentUser(client as unknown as AuthClient);
  } catch {
    await client.auth.signOut();
    return NextResponse.json(
      {
        code: "profile_unavailable",
        error: "Profil akun belum dapat dimuat. Coba lagi.",
      },
      { status: 500 },
    );
  }

  if (!context) {
    await client.auth.signOut();
    return NextResponse.json(
      {
        code: "profile_unavailable",
        error: "Profil akun belum dapat dimuat. Coba lagi.",
      },
      { status: 500 },
    );
  }

  context = await maybeLiftExpiredTemporarySuspension(
    client as unknown as RpcLiftClient,
    context,
  );

  if (context.status !== "active") {
    const errorMessage = getAccountStatusMessage(context.status);
    await client.auth.signOut();
    return NextResponse.json(
      { code: "inactive_account", error: errorMessage },
      { status: 403 },
    );
  }

  let verificationStatus: VerificationStatus | null = null;
  if (context.role === "supplier" || selectedRole === "supplier") {
    const { data: supplierProfile, error: supplierProfileError } = await client
      .from("supplier_profiles")
      .select("verification_status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (supplierProfileError && context.role === "supplier") {
      await client.auth.signOut();
      return NextResponse.json(
        {
          code: "profile_unavailable",
          error: "Profil akun belum dapat dimuat. Coba lagi.",
        },
        { status: 500 },
      );
    }
    verificationStatus =
      (supplierProfile as { verification_status?: VerificationStatus } | null)
        ?.verification_status ?? null;
  }

  if (context.role !== selectedRole) {
    const errorMessage = getRoleMismatchMessage(selectedRole, verificationStatus);
    const code =
      selectedRole === "supplier" && verificationStatus === "pending"
        ? "supplier_pending"
        : selectedRole === "supplier" && verificationStatus === "rejected"
          ? "supplier_rejected"
          : "role_mismatch";

    await client.auth.signOut();
    return NextResponse.json(
      { code, error: errorMessage },
      { status: 403 },
    );
  }

  const supplierReadOnly =
    context.role === "supplier" && verificationStatus !== "approved";
  const defaultRedirect = supplierReadOnly
    ? "/supplier/status"
    : LOGIN_REDIRECT_BY_ROLE[selectedRole];
  const safeReturnTo = supplierReadOnly
    ? null
    : sanitizeReturnTo(returnTo, context.role);

  return NextResponse.json({
    user: { email: context.email },
    profile: {
      role: context.role,
      status: context.status,
      fullName: context.fullName,
    },
    redirectTo: safeReturnTo ?? defaultRedirect,
  });
}