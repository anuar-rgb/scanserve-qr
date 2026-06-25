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

// POST — record a section view (called from landing page)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    sessionId?: string;
    section?: string;
    device?: string;
    referrer?: string;
  };

  if (!body.sessionId || !body.section) {
    return NextResponse.json({ error: "sessionId and section required" }, { status: 400 });
  }

  await db().from("landing_analytics").insert({
    session_id: body.sessionId,
    page: "/",
    section: body.section,
    device: body.device ?? null,
    referrer: body.referrer ?? null,
  });

  return NextResponse.json({ ok: true });
}

// GET — stats for super-admin (requires super_admin_session)
export async function GET(req: NextRequest) {
  const session = req.cookies.get("super_admin_session")?.value;
  if (session !== "authenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "30", 10);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const supabase = db();

  const { data: raw } = await supabase
    .from("landing_analytics")
    .select("session_id, section, device, referrer, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const records = raw ?? [];

  const uniqueSessions = new Set(records.map(r => r.session_id)).size;

  const sectionCounts: Record<string, number> = {};
  const sectionUnique: Record<string, Set<string>> = {};
  for (const r of records) {
    sectionCounts[r.section] = (sectionCounts[r.section] ?? 0) + 1;
    if (!sectionUnique[r.section]) sectionUnique[r.section] = new Set();
    sectionUnique[r.section].add(r.session_id);
  }

  const sections = Object.entries(sectionUnique)
    .map(([name, set]) => ({ name, uniqueViews: set.size, totalViews: sectionCounts[name] ?? 0 }))
    .sort((a, b) => b.uniqueViews - a.uniqueViews);

  const deviceCounts: Record<string, number> = {};
  const seenDevices = new Set<string>();
  for (const r of records) {
    const key = `${r.session_id}:${r.device}`;
    if (seenDevices.has(key)) continue;
    seenDevices.add(key);
    const d = r.device ?? "unknown";
    deviceCounts[d] = (deviceCounts[d] ?? 0) + 1;
  }

  const dailyCounts: Record<string, number> = {};
  const dailySessions: Record<string, Set<string>> = {};
  for (const r of records) {
    const day = r.created_at.slice(0, 10);
    if (!dailySessions[day]) dailySessions[day] = new Set();
    if (!dailySessions[day].has(r.session_id)) {
      dailySessions[day].add(r.session_id);
      dailyCounts[day] = (dailyCounts[day] ?? 0) + 1;
    }
  }

  const daily = Object.entries(dailyCounts)
    .map(([date, count]) => ({ date, visitors: count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    totalVisitors: uniqueSessions,
    totalViews: records.length,
    sections,
    devices: deviceCounts,
    daily,
  });
}
