import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@skolopals/shared/supabase/server";

function safeNext(next: string | null) {
  // Only allow same-site relative paths.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

// Target of the Supabase confirmation / invite email link.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Supabase's default invite email signs the user in with tokens in the URL fragment, which
  // never reaches the server. The browser carries the fragment across this redirect, and the
  // destination page picks the tokens up from there.
  if (!tokenHash && !code && next) {
    return NextResponse.redirect(new URL(next, origin));
  }

  const supabase = await createClient();
  const { error } = tokenHash && type
    ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error("Missing token") };

  return NextResponse.redirect(new URL(error ? "/login?confirm=failed" : (next ?? "/login"), origin));
}
