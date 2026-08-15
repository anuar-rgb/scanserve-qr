"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ChevronUp, ChevronDown, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import { useTranslations } from "@/lib/i18n";
import type { DbPaymentBank } from "@/lib/db-types";
import { useBranchRestaurantId } from "@/lib/branch-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type BankForm = {
  bank_name: string;
  phone: string;
  recipient_name: string;
  is_active: boolean;
};

const EMPTY_FORM: BankForm = {
  bank_name: "", phone: "", recipient_name: "", is_active: true,
};

export default function PaymentBanksPage() {
  const restaurantId = useBranchRestaurantId() ?? "";
  const { t } = useTranslations();

  const [banks, setBanks]         = useState<DbPaymentBank[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState<BankForm>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("payment_banks")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("order_index");
    if (data) setBanks(data as DbPaymentBank[]);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(b: DbPaymentBank) {
    setEditingId(b.id);
    setForm({
      bank_name: b.bank_name,
      phone: b.phone,
      recipient_name: b.recipient_name ?? "",
      is_active: b.is_active,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!isConfigured) { toast.error("Database not configured"); return; }
    if (!form.bank_name.trim() || !form.phone.trim()) {
      toast.error("Название банка и номер обязательны");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        bank_name: form.bank_name.trim(),
        phone: form.phone.trim(),
        recipient_name: form.recipient_name.trim() || null,
        is_active: form.is_active,
      };

      if (editingId) {
        await supabase.from("payment_banks").update(payload).eq("id", editingId);
      } else {
        const maxOrder = banks.length > 0 ? Math.max(...banks.map(b => b.order_index)) + 1 : 0;
        await supabase.from("payment_banks").insert({ ...payload, order_index: maxOrder });
      }

      await load();
      closeModal();
      toast.success(t.admin.paymentBankSaved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!isConfigured) return;
    setDeleting(id);
    const { error } = await supabase.from("payment_banks").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      setBanks(prev => prev.filter(b => b.id !== id));
      toast.success(t.admin.paymentBankDeleted);
    }
    setDeleting(null);
  }

  async function move(id: string, direction: "up" | "down") {
    if (!isConfigured) return;
    const idx = banks.findIndex(b => b.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === banks.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const updated = [...banks];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    const reindexed = updated.map((b, i) => ({ ...b, order_index: i }));
    setBanks(reindexed);
    await Promise.all(
      reindexed.map(b => supabase.from("payment_banks").update({ order_index: b.order_index }).eq("id", b.id))
    );
  }

  async function toggleActive(b: DbPaymentBank) {
    const next = !b.is_active;
    setBanks(prev => prev.map(x => x.id === b.id ? { ...x, is_active: next } : x));
    await supabase.from("payment_banks").update({ is_active: next }).eq("id", b.id);
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.admin.navPaymentBanks}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{t.admin.descPaymentBanks}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus />
          {t.admin.addPaymentBank}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-zinc-400 text-sm">
            <Loader2 size={16} className="animate-spin" />
            {t.admin.loadingCatalog}
          </div>
        ) : banks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-zinc-400">
            <CreditCard size={32} strokeWidth={1.5} />
            <p className="text-sm">{t.admin.noPaymentBanks}</p>
            <Button variant="link" onClick={openCreate} className="text-violet-500 hover:text-violet-600 p-0 h-auto">
              + {t.admin.addPaymentBank}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {banks.map((b, idx) => (
              <div
                key={b.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center">
                  <CreditCard size={18} className="text-zinc-400 dark:text-zinc-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {b.bank_name}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {b.phone}{b.recipient_name ? ` · ${b.recipient_name}` : ""}
                  </p>
                </div>

                <button onClick={() => toggleActive(b)} className="shrink-0">
                  <Badge className={`border-0 ${b.is_active
                    ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}>
                    {b.is_active ? t.admin.on : t.admin.off}
                  </Badge>
                </button>

                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon-xs" onClick={() => move(b.id, "up")} disabled={idx === 0}>
                    <ChevronUp size={14} className="text-zinc-500" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => move(b.id, "down")} disabled={idx === banks.length - 1}>
                    <ChevronDown size={14} className="text-zinc-500" />
                  </Button>
                </div>

                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(b)}>
                  <Pencil size={14} className="text-zinc-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(b.id)}
                  disabled={deleting === b.id}
                  className="hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  {deleting === b.id
                    ? <Loader2 size={14} className="animate-spin text-zinc-400" />
                    : <Trash2 size={14} className="text-red-500 dark:text-red-400" />
                  }
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t.admin.editPaymentBank : t.admin.addPaymentBank}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1">
            <div className="space-y-1.5">
              <Label>{t.admin.bankNameLabel}</Label>
              <Input
                value={form.bank_name}
                onChange={e => setForm(prev => ({ ...prev, bank_name: e.target.value }))}
                placeholder={t.admin.bankNamePlaceholder}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.admin.bankPhoneLabel}</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder={t.admin.bankPhonePlaceholder}
                type="tel"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.admin.bankRecipientLabel}</Label>
              <Input
                value={form.recipient_name}
                onChange={e => setForm(prev => ({ ...prev, recipient_name: e.target.value }))}
                placeholder={t.admin.bankRecipientPlaceholder}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label>{t.admin.bankActive}</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>
              {t.admin.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.bank_name.trim() || !form.phone.trim()}
            >
              {saving && <Loader2 className="animate-spin" />}
              {saving ? t.admin.saving : t.admin.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
