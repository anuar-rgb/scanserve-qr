"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Download, RefreshCw, QrCode, TableProperties } from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabase";
import { RESTAURANT_ID, DB_TABLES } from "@/constants";
import type { DbRestaurantTable } from "@/lib/db-types";
import { toast } from "sonner";

const MENU_BASE_URL =
  process.env.NEXT_PUBLIC_MENU_URL ??
  "https://scanserve-qr-production.up.railway.app/as-tori";

// ── Single QR card ─────────────────────────────────────────────────────────────

function TableQrCard({ table }: { table: DbRestaurantTable }) {
  const url = `${MENU_BASE_URL}?table=${encodeURIComponent(table.label)}`;
  const svgRef = useRef<SVGSVGElement>(null);

  function downloadSvg() {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-table-${table.label}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 print:shadow-none print:border-zinc-300">
      {/* QR */}
      <div className="rounded-xl bg-white p-3 shadow-sm print:shadow-none">
        <QRCodeSVG
          ref={svgRef}
          value={url}
          size={160}
          level="H"
          marginSize={0}
        />
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Стол</p>
        <p className="mt-0.5 text-2xl font-black tabular-nums">{table.label}</p>
        {table.seats > 0 && (
          <p className="text-[11px] text-muted-foreground">{table.seats} мест</p>
        )}
      </div>

      {/* URL hint */}
      <p className="max-w-[180px] break-all text-center text-[9px] text-muted-foreground/60 print:text-zinc-400">
        {url}
      </p>

      {/* Download button — hidden on print */}
      <button
        onClick={downloadSvg}
        className="print:hidden flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/30 transition-colors"
      >
        <Download size={13} />
        SVG
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function QrPage() {
  const [tables, setTables]   = useState<DbRestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from(DB_TABLES.restaurantTables)
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .eq("is_active", true)
      .order("label");
    if (error) {
      toast.error(`Ошибка загрузки столов: ${error.message}`);
    } else {
      setTables((data as DbRestaurantTable[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-border bg-background px-6 py-4 flex items-center gap-3 print:hidden">
        <QrCode size={20} className="text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold leading-none">QR-коды столов</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {tables.length > 0
              ? `${tables.length} ${tables.length === 1 ? "стол" : tables.length < 5 ? "стола" : "столов"} · гость сканирует → стол заполняется автоматически`
              : "Сначала добавьте столы в разделе «План зала»"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/30 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Обновить
          </button>
          <button
            onClick={() => window.print()}
            disabled={loading || tables.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <Printer size={13} />
            Печать всех
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto admin-scroll p-6 print:p-4">

        {loading && (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm gap-2">
            <RefreshCw size={16} className="animate-spin" />
            Загрузка столов…
          </div>
        )}

        {!loading && tables.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <TableProperties size={40} className="text-muted-foreground/40" />
            <div>
              <p className="font-semibold">Нет активных столов</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Добавьте столы в разделе <span className="font-medium">«План зала»</span>, затем вернитесь сюда
              </p>
            </div>
          </div>
        )}

        {!loading && tables.length > 0 && (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
          >
            {tables.map((t) => (
              <TableQrCard key={t.id} table={t} />
            ))}
          </div>
        )}
      </div>

      {/* ── Print styles ───────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .admin-scroll { overflow: visible !important; height: auto !important; }
        }
      `}</style>
    </div>
  );
}
