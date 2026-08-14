import { NextRequest, NextResponse } from "next/server";
import { supabase, isConfigured } from "@/lib/supabase";

// SQL to create the table (run once in Supabase SQL editor):
// CREATE TABLE IF NOT EXISTS landing_leads (
//   id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   name         TEXT NOT NULL,
//   venue        TEXT NOT NULL,
//   phone        TEXT NOT NULL,
//   city         TEXT,
//   tables       TEXT,
//   comment      TEXT,
//   plan         TEXT DEFAULT 'trial-7',
//   created_at   TIMESTAMPTZ DEFAULT NOW()
// );

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, venue, phone, city, tables, comment, plan } = body;

    if (!name || !venue || !phone) {
      return NextResponse.json({ error: "Заполните обязательные поля" }, { status: 400 });
    }

    if (isConfigured) {
      await supabase.from("landing_leads").insert({
        name: String(name).slice(0, 100),
        venue: String(venue).slice(0, 100),
        phone: String(phone).slice(0, 30),
        city: city ? String(city).slice(0, 50) : null,
        tables: tables ? String(tables).slice(0, 50) : null,
        comment: comment ? String(comment).slice(0, 500) : null,
        plan: plan || "trial-7",
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
