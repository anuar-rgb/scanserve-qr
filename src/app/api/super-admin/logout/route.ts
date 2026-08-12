import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Use delete() so Next.js automatically matches all original cookie attributes
  // (including Secure in production), ensuring the browser actually clears the cookie.
  response.cookies.delete("super_admin_session");
  return response;
}
