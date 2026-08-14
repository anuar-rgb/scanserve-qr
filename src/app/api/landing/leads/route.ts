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

// Env vars required for Telegram:
//   TELEGRAM_BOT_TOKEN — from @BotFather
//   TELEGRAM_CHAT_ID   — your personal chat ID (send /start to your bot, then GET /getUpdates)

async function sendTelegramNotification(data: {
  name: string; venue: string; phone: string;
  city: string | null; tables: string | null; comment: string | null; plan: string;
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const lines = [
    "🆕 <b>Новая заявка — ScanServe QR</b>",
    "",
    `👤 Имя: ${data.name}`,
    `🏪 Заведение: ${data.venue}`,
    `📞 Телефон: <code>${data.phone}</code>`,
    data.city    ? `📍 Город: ${data.city}`          : null,
    data.tables  ? `🪑 Размер: ${data.tables}`        : null,
    data.comment ? `💬 Комментарий: ${data.comment}`  : null,
  ].filter(Boolean).join("\n");

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: lines, parse_mode: "HTML" }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, venue, phone, city, tables, comment, plan } = body;

    if (!name || !venue || !phone) {
      return NextResponse.json({ error: "Заполните обязательные поля" }, { status: 400 });
    }

    const data = {
      name:    String(name).slice(0, 100),
      venue:   String(venue).slice(0, 100),
      phone:   String(phone).slice(0, 30),
      city:    city    ? String(city).slice(0, 50)    : null,
      tables:  tables  ? String(tables).slice(0, 50)  : null,
      comment: comment ? String(comment).slice(0, 500) : null,
      plan:    plan || "trial-7",
    };

    if (isConfigured) {
      const { error } = await supabase.from("landing_leads").insert(data);
      if (error) console.error("[leads] supabase error:", error.message);
    }

    // Fire-and-forget — Telegram failure never blocks the response
    sendTelegramNotification(data).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
