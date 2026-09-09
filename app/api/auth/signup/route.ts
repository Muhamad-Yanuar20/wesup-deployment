import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,19}$/;

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "signup");
  if (limited) return limited;

  const client = await getServerClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }
  if (!fullName) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }
  if (!PHONE_RE.test(phone)) {
    return NextResponse.json({ error: "Valid WhatsApp number is required" }, { status: 400 });
  }

  // The public UMKM endpoint intentionally never forwards a browser-selected role.
  // The database trigger creates this signup as `umkm`; Supplier uses its own flow.
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
    phone,
  });

  if (error) {
    if (error.code === "user_already_exists" || /already registered|already exists|email exists/i.test(error.message ?? "")) {
      return NextResponse.json(
        {
          code: "email_registered_other_role",
          error: "Email ini sudah terdaftar untuk role lain. Silakan masuk menggunakan role akun sebelumnya.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(
    {
      user: data.user,
      requiresEmailConfirmation: data.session === null,
    },
    { status: 201 },
  );
}
