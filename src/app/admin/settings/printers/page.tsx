"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, Loader2, Printer, Wifi, WifiOff, FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbCategory } from "@/lib/db-types";
import { useBranchRestaurantId } from "@/lib/branch-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PrinterRow {
  id: string;
  restaurant_id: string;
  printer_name: string;
  ip_address: string;
  port: number;
  categories: string[]; // category UUIDs
  is_active: boolean;
  order_index: number;
  created_at: string;
}

type PrinterForm = {
  printer_name: string;
  ip_address: string;
  port: string;
  categories: string[]; // selected category UUIDs
  is_active: boolean;
};

const EMPTY_FORM: PrinterForm = {
  printer_name: "",
  ip_address: "",
  port: "9100",
  categories: [],
  is_active: true,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrintersPage() {
  const restaurantId = useBranchRestaurantId() ?? "";
  const [printers, setPrinters]     = useState<PrinterRow[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<PrinterForm>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [testing, setTesting]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const [{ data: ps }, { data: cats }] = await Promise.all([
      supabase
        .from("printer_settings")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("order_index"),
      supabase
        .from("categories")
        .select("id, name, parent_id")
        .eq("restaurant_id", restaurantId)
        .is("parent_id", null)
        .order("order_index"),
    ]);
    if (ps) setPrinters(ps as PrinterRow[]);
    if (cats) setCategories(cats as DbCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, order_index: printers.length } as PrinterForm & { order_index?: number });
    setModalOpen(true);
  }

  function openEdit(p: PrinterRow) {
    setEditingId(p.id);
    setForm({
      printer_name: p.printer_name,
      ip_address:   p.ip_address,
      port:         String(p.port),
      categories:   Array.isArray(p.categories) ? p.categories : [],
      is_active:    p.is_active,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!form.printer_name.trim()) { toast.error("Введите название принтера"); return; }
    if (!form.ip_address.trim())   { toast.error("Введите IP-адрес"); return; }
    const port = parseInt(form.port, 10);
    if (isNaN(port) || port < 1 || port > 65535) { toast.error("Некорректный порт"); return; }

    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      printer_name:  form.printer_name.trim(),
      ip_address:    form.ip_address.trim(),
      port,
      categories:    form.categories,
      is_active:     form.is_active,
      order_index:   editingId
        ? (printers.find((p) => p.id === editingId)?.order_index ?? 0)
        : printers.length,
    };

    if (editingId) {
      const { error } = await supabase
        .from("printer_settings")
        .update(payload)
        .eq("id", editingId);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from("printer_settings")
        .insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }

    toast.success(editingId ? "Принтер обновлён" : "Принтер добавлен");
    setSaving(false);
    closeModal();
    load();
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const { error } = await supabase.from("printer_settings").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Удалено"); load(); }
    setDeleting(null);
  }

  async function handleTest(printer: PrinterRow) {
    setTesting(printer.id);
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:        "test",
          restaurantId: restaurantId,
          printerId:   printer.id,
        }),
      });
      const json = (await res.json()) as { noPrinters?: boolean; results?: { printerName: string; success: boolean; error?: string }[] };
      if (json.noPrinters) {
        toast.error("Принтер не найден");
      } else {
        const r = json.results?.[0];
        if (r?.success) toast.success(`${r.printerName} — тест успешен`);
        else toast.error(r?.error ?? "Ошибка печати");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Сетевая ошибка");
    }
    setTesting(null);
  }

  function toggleCategory(catId: string) {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(catId)
        ? prev.categories.filter((id) => id !== catId)
        : [...prev.categories, catId],
    }));
  }

  // ── Category display name (Russian) ────────────────────────────────────────
  function catName(cat: DbCategory): string {
    const n = cat.name;
    if (typeof n === "string") return n;
    return (n as { ru?: string; en?: string; kz?: string }).ru ?? (n as { en?: string }).en ?? "—";
  }

  function getCategoryNames(ids: string[]): string {
    if (!ids || ids.length === 0) return "Все блюда";
    return ids
      .map((id) => {
        const cat = categories.find((c) => c.id === id);
        return cat ? catName(cat) : id.slice(0, 8);
      })
      .join(", ");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Printer size={20} /> Сетевые принтеры
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            LAN / Ethernet принтеры для кухонных бегунков и пречеков (порт 9100)
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus size={14} /> Добавить
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : printers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Printer size={40} className="text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Принтеры не добавлены</p>
          <p className="text-muted-foreground/60 text-xs max-w-xs">
            Добавьте сетевой принтер с IP-адресом в локальной сети для автоматической отправки бегунков.
          </p>
          <Button variant="outline" size="sm" onClick={openCreate} className="gap-1.5 mt-2">
            <Plus size={14} /> Добавить принтер
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {printers.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
            >
              {/* Icon */}
              <div className={`mt-0.5 rounded-lg p-2 ${p.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                <Printer size={18} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{p.printer_name}</span>
                  {p.is_active
                    ? <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px] gap-1"><Wifi size={9} /> Активен</Badge>
                    : <Badge variant="outline" className="text-muted-foreground text-[10px] gap-1"><WifiOff size={9} /> Отключён</Badge>
                  }
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {p.ip_address}:{p.port}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Категории: <span className="text-foreground">{getCategoryNames(p.categories)}</span>
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={!p.is_active || testing === p.id}
                  onClick={() => handleTest(p)}
                >
                  {testing === p.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : <FlaskConical size={11} />
                  }
                  Тест
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(p)}>
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  disabled={deleting === p.id}
                  onClick={() => handleDelete(p.id)}
                >
                  {deleting === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Network info box */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm space-y-1.5 text-muted-foreground">
        <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Как подключить принтер</p>
        <p>1. Подключите принтер к той же локальной сети (Wi-Fi или LAN), что и сервер.</p>
        <p>2. Назначьте принтеру статический IP-адрес через его настройки или роутер.</p>
        <p>3. Введите IP-адрес выше и нажмите «Тест» — принтер должен напечатать тестовую страницу и пискнуть.</p>
        <p>4. В поле «Категории» выберите категории меню, которые должны печататься на этом принтере (пусто = все).</p>
      </div>

      {/* Create / Edit modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактировать принтер" : "Новый принтер"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Название</Label>
              <Input
                placeholder="Принтер Кухни"
                value={form.printer_name}
                onChange={(e) => setForm((f) => ({ ...f, printer_name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>IP-адрес</Label>
                <Input
                  placeholder="192.168.1.100"
                  value={form.ip_address}
                  onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Порт</Label>
                <Input
                  placeholder="9100"
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                  className="font-mono"
                />
              </div>
            </div>

            {/* Category selector */}
            <div className="space-y-1.5">
              <Label>Категории блюд</Label>
              <p className="text-xs text-muted-foreground">
                Пусто — получает все неотсортированные блюда (catch-all).
              </p>
              {categories.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Категории не загружены</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-1">
                  {categories.map((cat) => {
                    const selected = form.categories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          selected
                            ? "bg-violet-600 border-violet-600 text-white"
                            : "border-border text-muted-foreground hover:border-violet-400 hover:text-foreground"
                        }`}
                      >
                        {catName(cat)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label>Активен</Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeModal}>Отмена</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editingId ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
