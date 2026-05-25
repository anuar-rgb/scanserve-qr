import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// GET — public endpoint: fetch sign request details by token
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = db();

  const { data: sig } = await supabase
    .from("employee_signatures")
    .select(`
      id,
      status,
      signed_at,
      signature_image,
      document_id,
      staff_user_id,
      company_documents (
        title,
        content
      )
    `)
    .eq("sign_token", token)
    .maybeSingle();

  if (!sig) return NextResponse.json({ error: "Link not found or expired" }, { status: 404 });

  // Get staff display name
  const { data: staff } = await supabase
    .from("staff_users")
    .select("display_name, username")
    .eq("id", sig.staff_user_id)
    .maybeSingle();

  const doc = Array.isArray(sig.company_documents)
    ? sig.company_documents[0]
    : sig.company_documents;

  return NextResponse.json({
    status:         sig.status,
    signedAt:       sig.signed_at,
    staffName:      staff?.display_name ?? staff?.username ?? "Сотрудник",
    signatureImage: sig.status === "signed" ? (sig.signature_image ?? null) : null,
    document: {
      title:   doc?.title   ?? "",
      content: doc?.content ?? "",
    },
  });
}

// Parses a raw User-Agent string into a human-readable device description.
function parseUserAgent(ua: string): string {
  if (!ua) return "Неизвестное устройство";

  const ios     = /iPhone|iPad|iPod/.test(ua);
  const android = /Android/.test(ua);
  const safari  = /Safari\//.test(ua) && !/Chrome\//.test(ua);
  const chrome  = /Chrome\//.test(ua) && !/Edg\//.test(ua);
  const firefox = /Firefox\//.test(ua);
  const edge    = /Edg\//.test(ua);
  const samsung = /SamsungBrowser/.test(ua);

  let browser = chrome ? "Chrome" : firefox ? "Firefox" : edge ? "Edge" : samsung ? "Samsung" : safari ? "Safari" : "Browser";

  if (ios) {
    const match = ua.match(/OS (\d+[_\d]*)/);
    const ver   = match ? ` ${match[1].replace(/_/g, ".")}` : "";
    const dev   = /iPad/.test(ua) ? "iPadOS" : "iOS";
    return `${dev}${ver} / ${browser}`;
  }

  if (android) {
    const verMatch   = ua.match(/Android ([\d.]+)/);
    const ver        = verMatch ? ` ${verMatch[1]}` : "";
    // Try to extract device brand/model between "; " and " Build/"
    const modelMatch = ua.match(/;\s+([^;()]+)\s+Build\//);
    const model      = modelMatch ? ` / ${modelMatch[1].trim()}` : "";
    return `Android${ver} / ${browser}${model}`;
  }

  const win = /Windows NT/.test(ua);
  const mac = /Macintosh/.test(ua);
  if (win) return `Windows / ${browser}`;
  if (mac) return `macOS / ${browser}`;

  return `${browser}`;
}

// POST — public endpoint: submit handwritten signature
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({})) as { signatureImage?: string; userAgent?: string };

  if (!body.signatureImage) {
    return NextResponse.json({ error: "signatureImage required" }, { status: 400 });
  }

  // Capture IP address for legal record
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const deviceModel = parseUserAgent(body.userAgent ?? req.headers.get("user-agent") ?? "");

  const supabase = db();

  // Verify token exists and is still pending; also get staff_user_id for phone lookup
  const { data: sig } = await supabase
    .from("employee_signatures")
    .select("id, status, staff_user_id")
    .eq("sign_token", token)
    .maybeSingle();

  if (!sig) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (sig.status === "signed") {
    return NextResponse.json({ error: "Already signed" }, { status: 409 });
  }

  // Fetch phone from staff profile (server-side — cannot be spoofed by client)
  const { data: staff } = await supabase
    .from("staff_users")
    .select("phone")
    .eq("id", sig.staff_user_id)
    .maybeSingle();

  const { error } = await supabase
    .from("employee_signatures")
    .update({
      signature_image: body.signatureImage,
      signed_at:       new Date().toISOString(),
      ip_address:      ip,
      device_model:    deviceModel,
      phone_number:    staff?.phone ?? null,
      status:          "signed",
    })
    .eq("id", sig.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
