"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus, Pencil, Trash2, FileText, RefreshCw, X, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import { useTranslations } from "@/lib/i18n";
import type { DbInvoice, DbInvoiceItem } from "@/lib/db-types";
import { RESTAURANT_ID } from "@/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// ─── types ───────────────────────────────────────────────────────────────────

type Period = "today" | "week" | "month";

interface LineItem {
  id: string;
  item_name: string;
  quantity: string;
  unit: string;
  price_per_unit: string;
}

interface InvoiceWithItems extends DbInvoice {
  invoice_items?: DbInvoiceItem[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const PERIOD_LABEL: Record<Period, string> = {
  today: "Сегодня",
  week: "7 дней",
  month: "30 дней",
};

function fromDate(p: Period): Date {
  const d = new Date();
  if (p === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (p === "week")  { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d; }
  d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function calcTotal(lines: LineItem[]): number {
  return lines.reduce((s, l) => {
    const q = parseFloat(l.quantity)        || 0;
    const p = parseFloat(l.price_per_unit)  || 0;
    return s + q * p;
  }, 0);
}

const UNITS = ["шт", "кг", "г", "л", "мл", "уп", "пачка", "м"];

const EMPTY_LINE = (): LineItem => ({
  id: crypto.randomUUID(),
  item_name: "",
  quantity: "",
  unit: "шт",
  price_per_unit: "",
});

// ─── main component ───────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { t } = useTranslations();
  const [period, setPeriod]           = useState<Period>("week");
  const [loading, setLoading]         = useState(true);
  const [invoices, setInvoices]       = useState<InvoiceWithItems[]>([]);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [modalOpen, setModalOpen]     = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [deleting, setDeleting]       = useState<string | null>(null);

  // ── form state ──
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplierName,  setSupplierName]  = useState("");
  const [createdBy,     setCreatedBy]     = useState("");
  const [invoiceDate,   setInvoiceDate]   = useState("");
  const [lines, setLines] = useState<LineItem[]>([EMPTY_LINE()]);

  // ── load ──
  const load = useCallback(async (p: Period) => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const from = fromDate(p).toISOString();
    const now  = new Date().toISOString();
    const { data } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("restaurant_id", RESTAURANT_ID)
      .gte("created_at", from)
      .lte("created_at", now)
      .order("created_at", { ascending: false });
    setInvoices((data ?? []) as InvoiceWithItems[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(period); }, [load, period]);

  // ── open modal ──
  function openAdd() {
    setEditingId(null);
    setInvoiceNumber("");
    setSupplierName("");
    setCreatedBy("");
    setInvoiceDate(new Date().toISOString().slice(0, 16));
    setLines([EMPTY_LINE()]);
    setModalOpen(true);
  }

  function openEdit(inv: InvoiceWithItems) {
    setEditingId(inv.id);
    setInvoiceNumber(inv.invoice_number ?? "");
    setSupplierName(inv.supplier_name);
    setCreatedBy(inv.created_by ?? "");
    setInvoiceDate(inv.created_at.slice(0, 16));
    const existing = (inv.invoice_items ?? []).map(it => ({
      id: it.id,
      item_name: it.item_name,
      quantity: String(it.quantity),
      unit: it.unit,
      price_per_unit: String(it.price_per_unit),
    }));
    setLines(existing.length > 0 ? existing : [EMPTY_LINE()]);
    setModalOpen(true);
  }

  // ── save ──
  async function handleSave() {
    if (!supplierName.trim()) { toast.error("Укажите поставщика"); return; }
    if (lines.some(l => !l.item_name.trim())) { toast.error("Заполните название товара во всех строках"); return; }
    setSaving(true);

    const totalAmount = calcTotal(lines);
    const createdAt   = invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString();

    if (editingId) {
      // update invoice header
      const { error: hErr } = await supabase
        .from("invoices")
        .update({
          invoice_number: invoiceNumber.trim() || null,
          supplier_name: supplierName.trim(),
          total_amount: totalAmount,
          created_by: createdBy.trim() || null,
          created_at: createdAt,
        })
        .eq("id", editingId);
      if (hErr) { toast.error(hErr.message); setSaving(false); return; }

      // delete old items then re-insert
      await supabase.from("invoice_items").delete().eq("invoice_id", editingId);
      const itemRows = lines.map(l => ({
        invoice_id: editingId,
        item_name: l.item_name.trim(),
        quantity: parseFloat(l.quantity) || 0,
        unit: l.unit,
        price_per_unit: parseFloat(l.price_per_unit) || 0,
        total_item_price: (parseFloat(l.quantity) || 0) * (parseFloat(l.price_per_unit) || 0),
      }));
      const { error: iErr } = await supabase.from("invoice_items").insert(itemRows);
      if (iErr) { toast.error(iErr.message); setSaving(false); return; }

      toast.success(t.admin.invoiceSaved);
      setModalOpen(false);
      load(period);
    } else {
      // insert invoice
      const { data: inv, error: hErr } = await supabase
        .from("invoices")
        .insert({
          restaurant_id: RESTAURANT_ID,
          invoice_number: invoiceNumber.trim() || null,
          supplier_name: supplierName.trim(),
          total_amount: totalAmount,
          created_by: createdBy.trim() || null,
          created_at: createdAt,
        })
        .select()
        .single();
      if (hErr || !inv) { toast.error(hErr?.message ?? "Error"); setSaving(false); return; }

      const itemRows = lines.map(l => ({
        invoice_id: inv.id,
        item_name: l.item_name.trim(),
        quantity: parseFloat(l.quantity) || 0,
        unit: l.unit,
        price_per_unit: parseFloat(l.price_per_unit) || 0,
        total_item_price: (parseFloat(l.quantity) || 0) * (parseFloat(l.price_per_unit) || 0),
      }));
      const { error: iErr } = await supabase.from("invoice_items").insert(itemRows);
      if (iErr) { toast.error(iErr.message); setSaving(false); return; }

      toast.success(t.admin.invoiceSaved);
      setModalOpen(false);
      load(period);
    }
    setSaving(false);
  }

  // ── delete ──
  async function handleDelete(id: string) {
    if (!confirm("Удалить накладную?")) return;
    setDeleting(id);
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) { toast.error(error.message); }
    else {
      toast.success(t.admin.invoiceDeleted);
      setInvoices(prev => prev.filter(i => i.id !== id));
    }
    setDeleting(null);
  }

  // ── line helpers ──
  function updateLine(idx: number, field: keyof LineItem, value: string) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }
  function addLine()        { setLines(prev => [...prev, EMPTY_LINE()]); }
  function removeLine(idx: number) { setLines(prev => prev.filter((_, i) => i !== idx)); }

  const total = calcTotal(lines);
  const grandTotal = invoices.reduce((s, inv) => s + (inv.total_amount ?? 0), 0);

  return (
    <div className="flex flex-col h-full">

      {/* ── Modal ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t.admin.editInvoice : t.admin.addInvoice}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Top fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t.admin.invoiceNumberLabel}</Label>
                <Input
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder={t.admin.invoiceNumberPlaceholder}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{t.admin.supplierNameLabel} *</Label>
                <Input
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  placeholder={t.admin.supplierNamePlaceholder}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{t.admin.invoiceDateLabel}</Label>
                <Input
                  type="datetime-local"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{t.admin.createdByLabel}</Label>
                <Input
                  value={createdBy}
                  onChange={e => setCreatedBy(e.target.value)}
                  placeholder={t.admin.createdByPlaceholder}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Line items table */}
            <div>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 80px 72px 100px 90px 32px" }}>
                {/* header */}
                {[t.admin.invoiceItemName, t.admin.invoiceItemQty, t.admin.invoiceItemUnit, t.admin.invoiceItemPrice, t.admin.invoiceItemTotal, ""].map((h, i) => (
                  <p key={i} className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 px-1">{h}</p>
                ))}
                {/* rows */}
                {lines.map((line, idx) => {
                  const rowTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.price_per_unit) || 0);
                  return (
                    <LineRow
                      key={line.id}
                      line={line}
                      rowTotal={rowTotal}
                      onChange={(f, v) => updateLine(idx, f, v)}
                      onRemove={() => removeLine(idx)}
                      canRemove={lines.length > 1}
                    />
                  );
                })}
              </div>

              <button
                onClick={addLine}
                className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline">
                {t.admin.addInvoiceRow}
              </button>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 px-4 py-3">
              <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                {t.admin.invoiceTotal}
              </span>
              <span className="text-lg font-black tabular-nums text-violet-700 dark:text-violet-300">
                {total.toLocaleString("ru-RU")} ₸
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t.admin.cancel}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw size={14} className="animate-spin mr-2" /> : null}
              {t.admin.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── header ── */}
      <header className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.admin.invoicesTitle}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{t.admin.descInvoices}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl text-xs">
            {(["today", "week", "month"] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} disabled={loading}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  period === p
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}>
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          <button onClick={() => load(period)} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Обновить
          </button>
          <Button onClick={openAdd} size="sm" className="flex items-center gap-2">
            <Plus size={14} />
            {t.admin.addInvoice}
          </Button>
        </div>
      </header>

      {/* ── body ── */}
      <div className="flex-1 overflow-y-auto p-8 space-y-4">

        {/* Summary card */}
        {!loading && invoices.length > 0 && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500 font-medium">{t.admin.expenses} · {PERIOD_LABEL[period]}</p>
              <p className="text-2xl font-black tabular-nums text-zinc-900 dark:text-zinc-100 mt-1">
                {grandTotal.toLocaleString("ru-RU")} ₸
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
              <FileText size={20} />
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30 overflow-hidden">
          {/* col headers */}
          <div className="grid px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800/60"
            style={{ gridTemplateColumns: "1fr 130px 150px 130px 96px 80px" }}>
            {["Дата / Время", "Номер", "Поставщик", "Сумма (₸)", "Сотрудник", ""].map((h, i) => (
              <p key={i} className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{h}</p>
            ))}
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-zinc-400">
              <RefreshCw size={16} className="animate-spin mx-auto mb-2" />
              Загрузка…
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={32} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
              <p className="text-sm text-zinc-400">{t.admin.noInvoices}</p>
              <Button onClick={openAdd} variant="outline" size="sm" className="mt-4 gap-2">
                <Plus size={13} /> {t.admin.addInvoice}
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {invoices.map(inv => {
                const isExp = expanded === inv.id;
                const items = inv.invoice_items ?? [];
                return (
                  <div key={inv.id}>
                    <div
                      className="grid items-center px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      style={{ gridTemplateColumns: "1fr 130px 150px 130px 96px 80px" }}
                      onClick={() => setExpanded(isExp ? null : inv.id)}>
                      <div className="flex items-center gap-2">
                        <ChevronDown size={13} className={`text-zinc-400 transition-transform shrink-0 ${isExp ? "rotate-180" : ""}`} />
                        <span className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
                          {fmtDateTime(inv.created_at)}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-zinc-500">{inv.invoice_number ?? "—"}</span>
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{inv.supplier_name}</span>
                      <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {inv.total_amount.toLocaleString("ru-RU")} ₸
                      </span>
                      <span className="text-xs text-zinc-500 truncate">{inv.created_by ?? "—"}</span>
                      <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(inv)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(inv.id)}
                          disabled={deleting === inv.id}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                          {deleting === inv.id
                            ? <RefreshCw size={13} className="animate-spin" />
                            : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* expanded items */}
                    {isExp && items.length > 0 && (
                      <div className="px-10 pb-3">
                        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                          <div className="grid px-3 py-2 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800"
                            style={{ gridTemplateColumns: "1fr 80px 60px 100px 110px" }}>
                            {[t.admin.invoiceItemName, t.admin.invoiceItemQty, t.admin.invoiceItemUnit, t.admin.invoiceItemPrice, t.admin.invoiceItemTotal].map((h, i) => (
                              <p key={i} className="text-[9px] font-semibold uppercase tracking-widest text-zinc-400">{h}</p>
                            ))}
                          </div>
                          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {items.map(it => (
                              <div key={it.id} className="grid px-3 py-2"
                                style={{ gridTemplateColumns: "1fr 80px 60px 100px 110px" }}>
                                <span className="text-xs text-zinc-700 dark:text-zinc-300">{it.item_name}</span>
                                <span className="text-xs tabular-nums text-zinc-500">{it.quantity}</span>
                                <span className="text-xs text-zinc-500">{it.unit}</span>
                                <span className="text-xs tabular-nums text-zinc-500">
                                  {it.price_per_unit.toLocaleString("ru-RU")} ₸
                                </span>
                                <span className="text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                                  {it.total_item_price.toLocaleString("ru-RU")} ₸
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LineRow sub-component ────────────────────────────────────────────────────

function LineRow({ line, rowTotal, onChange, onRemove, canRemove }: {
  line: LineItem;
  rowTotal: number;
  onChange: (f: keyof LineItem, v: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <>
      <Input
        value={line.item_name}
        onChange={e => onChange("item_name", e.target.value)}
        placeholder="Молоко 3.2%"
        className="h-8 text-xs"
      />
      <Input
        value={line.quantity}
        onChange={e => onChange("quantity", e.target.value)}
        placeholder="10"
        type="number"
        min="0"
        step="0.001"
        className="h-8 text-xs"
      />
      <select
        value={line.unit}
        onChange={e => onChange("unit", e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <Input
        value={line.price_per_unit}
        onChange={e => onChange("price_per_unit", e.target.value)}
        placeholder="0"
        type="number"
        min="0"
        step="0.01"
        className="h-8 text-xs"
      />
      <p className="h-8 flex items-center px-1 text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
        {rowTotal > 0 ? rowTotal.toLocaleString("ru-RU") : "—"}
      </p>
      <button
        onClick={onRemove}
        disabled={!canRemove}
        className="h-8 w-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-20 transition-colors">
        <X size={13} />
      </button>
    </>
  );
}
