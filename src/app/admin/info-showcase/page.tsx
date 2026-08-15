"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ChevronUp, ChevronDown, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import { useTranslations } from "@/lib/i18n";
import type { DbInfoShowcase } from "@/lib/db-types";
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

type ShowcaseForm = {
  title: string;
  emoji: string;
  description: string;
  is_active: boolean;
};

const EMPTY_FORM: ShowcaseForm = {
  title: "", emoji: "✨", description: "", is_active: true,
};

export default function InfoShowcasePage() {
  const restaurantId = useBranchRestaurantId() ?? "";
  const { t } = useTranslations();

  const [cards, setCards]       = useState<DbInfoShowcase[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]         = useState<ShowcaseForm>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("info_showcases")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("order_index");
    if (data) setCards(data as DbInfoShowcase[]);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(c: DbInfoShowcase) {
    setEditingId(c.id);
    setForm({
      title: c.title?.ru ?? c.title?.en ?? "",
      emoji: c.emoji,
      description: c.description ?? "",
      is_active: c.is_active,
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
    setSaving(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        title: { en: form.title, ru: form.title, kz: form.title },
        emoji: form.emoji || "✨",
        description: form.description.trim() || null,
        is_active: form.is_active,
      };

      if (editingId) {
        await supabase.from("info_showcases").update(payload).eq("id", editingId);
      } else {
        const maxOrder = cards.length > 0 ? Math.max(...cards.map(c => c.order_index)) + 1 : 0;
        await supabase.from("info_showcases").insert({ ...payload, order_index: maxOrder });
      }

      await load();
      closeModal();
      toast.success(t.admin.showcaseCardSaved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save card");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!isConfigured) return;
    setDeleting(id);
    const { error } = await supabase.from("info_showcases").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete card");
    } else {
      setCards(prev => prev.filter(c => c.id !== id));
      toast.success("Card deleted");
    }
    setDeleting(null);
  }

  async function move(id: string, direction: "up" | "down") {
    if (!isConfigured) return;
    const idx = cards.findIndex(c => c.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === cards.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const updated = [...cards];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    const reindexed = updated.map((c, i) => ({ ...c, order_index: i }));
    setCards(reindexed);
    await Promise.all(
      reindexed.map(c => supabase.from("info_showcases").update({ order_index: c.order_index }).eq("id", c.id))
    );
  }

  async function toggleActive(c: DbInfoShowcase) {
    const next = !c.is_active;
    setCards(prev => prev.map(x => x.id === c.id ? { ...x, is_active: next } : x));
    await supabase.from("info_showcases").update({ is_active: next }).eq("id", c.id);
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.admin.navInfoShowcase}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{t.admin.descInfoShowcase}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus />
          {t.admin.addShowcaseCard}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-zinc-400 text-sm">
            <Loader2 size={16} className="animate-spin" />
            {t.admin.loadingCatalog}
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-zinc-400">
            <LayoutGrid size={32} strokeWidth={1.5} />
            <p className="text-sm">{t.admin.noShowcaseCards}</p>
            <Button variant="link" onClick={openCreate} className="text-violet-500 hover:text-violet-600 p-0 h-auto">
              + {t.admin.addShowcaseCard}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {cards.map((c, idx) => (
              <div
                key={c.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30"
              >
                {/* Emoji preview */}
                <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center text-xl">
                  {c.emoji || "✨"}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {c.title?.ru || c.title?.en || "—"}
                  </p>
                  {c.description && (
                    <p className="text-xs text-zinc-400 truncate">{c.description}</p>
                  )}
                </div>

                <button
                  onClick={() => toggleActive(c)}
                  className="shrink-0"
                >
                  <Badge className={`border-0 ${c.is_active
                    ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}>
                    {c.is_active ? t.admin.on : t.admin.off}
                  </Badge>
                </button>

                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon-xs" onClick={() => move(c.id, "up")} disabled={idx === 0}>
                    <ChevronUp size={14} className="text-zinc-500" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => move(c.id, "down")} disabled={idx === cards.length - 1}>
                    <ChevronDown size={14} className="text-zinc-500" />
                  </Button>
                </div>

                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)}>
                  <Pencil size={14} className="text-zinc-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(c.id)}
                  disabled={deleting === c.id}
                  className="hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  {deleting === c.id
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
              {editingId ? t.admin.editShowcaseCard : t.admin.addShowcaseCard}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Emoji */}
            <div className="space-y-1.5">
              <Label>{t.admin.showcaseCardEmojiLabel}</Label>
              <Input
                value={form.emoji}
                onChange={e => setForm(prev => ({ ...prev, emoji: e.target.value }))}
                placeholder="✨"
                className="text-xl"
              />
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label>{t.admin.showcaseCardTitleLabel}</Label>
              <Input
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Доставка"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Описание (текст попапа)</Label>
              <textarea
                rows={4}
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Например: пароль Wi-Fi: mypassword123"
                style={{ color: "inherit" }}
                className="flex w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 resize-none"
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between py-1">
              <Label>{t.admin.showcaseCardActive}</Label>
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
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? t.admin.saving : t.admin.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
