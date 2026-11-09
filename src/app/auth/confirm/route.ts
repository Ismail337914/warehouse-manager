import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

// Only password reset links: accounts are created by admins with a confirmed e-mail, so sign-up, invite and
// magic-link tokens are never sent by this app and are refused here.
const allowedTypes: EmailOtpType[] = ["recovery"];

function isAllowedType(value: string | null): value is EmailOtpType {
  return allowedTypes.includes(value as EmailOtpType);
}

// Target of the password reset e-mail (supabase/templates/recovery.html). Verifies the one-time token on the
// server, stores the session in cookies and continues to ?next= (only same-site paths).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  const supabase = await createClient();

  if (tokenHash && isAllowedType(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (code) {
    // Default Supabase e-mail templates send a PKCE code instead of a token hash.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
