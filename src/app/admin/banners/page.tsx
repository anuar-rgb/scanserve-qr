"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ImageIcon, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import { useTranslations } from "@/lib/i18n";
import type { DbBanner } from "@/lib/db-types";
import { uploadImage } from "@/services/storage";
import { RESTAURANT_ID } from "@/constants";
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

type BannerForm = {
  title: string;
  link_url: string;
  is_active: boolean;
  imageFile: File | null;
  imagePreview: string | null;
};

const EMPTY_FORM: BannerForm = {
  title: "", link_url: "", is_active: true,
  imageFile: null, imagePreview: null,
};

export default function BannersPage() {
  const { t } = useTranslations();
  const fileRef = useRef<HTMLInputElement>(null);

  const [banners, setBanners]     = useState<DbBanner[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState<BannerForm>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("banners")
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .order("order_index");
    if (data) setBanners(data as DbBanner[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(b: DbBanner) {
    setEditingId(b.id);
    setForm({
      title: b.title?.ru ?? b.title?.en ?? "",
      link_url: b.link_url ?? "",
      is_active: b.is_active,
      imageFile: null,
      imagePreview: b.image_url,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setForm(prev => ({ ...prev, imageFile: f, imagePreview: URL.createObjectURL(f) }));
  }

  async function handleSave() {
    if (!isConfigured) { toast.error("Database not configured"); return; }
    setSaving(true);
    try {
      let imageUrl: string | null = null;
      if (form.imageFile) {
        imageUrl = await uploadImage(form.imageFile, "banners", "banner");
      }

      const payload = {
        restaurant_id: RESTAURANT_ID,
        title: { en: form.title, ru: form.title, kz: form.title },
        link_url: form.link_url || null,
        is_active: form.is_active,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };

      if (editingId) {
        await supabase.from("banners").update(payload).eq("id", editingId);
      } else {
        const maxOrder = banners.length > 0 ? Math.max(...banners.map(b => b.order_index)) + 1 : 0;
        await supabase.from("banners").insert({ ...payload, order_index: maxOrder });
      }

      await load();
      closeModal();
      toast.success(t.admin.bannerSaved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save banner");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!isConfigured) return;
    setDeleting(id);
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete banner");
    } else {
      setBanners(prev => prev.filter(b => b.id !== id));
      toast.success("Banner deleted");
    }
    setDeleting(null);
  }

  async function move(id: string, direction: "up" | "down") {
    if (!isConfigured) return;
    const idx = banners.findIndex(b => b.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === banners.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const updated = [...banners];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    const reindexed = updated.map((b, i) => ({ ...b, order_index: i }));
    setBanners(reindexed);
    await Promise.all(
      reindexed.map(b => supabase.from("banners").update({ order_index: b.order_index }).eq("id", b.id))
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.admin.navBanners}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{t.admin.descBanners}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus />
          {t.admin.addBanner}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-zinc-400 text-sm">
            <Loader2 size={16} className="animate-spin" />
            {t.admin.loadingCatalog}
          </div>
        ) : banners.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-zinc-400">
            <ImageIcon size={32} strokeWidth={1.5} />
            <p className="text-sm">{t.admin.noBanners}</p>
            <Button variant="link" onClick={openCreate} className="text-violet-500 hover:text-violet-600 p-0 h-auto">
              + {t.admin.addBanner}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {banners.map((b, idx) => (
              <div
                key={b.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30"
              >
                <div className="w-20 h-12 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center">
                  {b.image_url ? (
                    <img src={b.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={16} className="text-zinc-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {b.title?.ru || b.title?.en || "—"}
                  </p>
                  {b.link_url && (
                    <p className="text-xs text-zinc-400 truncate">{b.link_url}</p>
                  )}
                </div>

                <Badge className={`shrink-0 border-0 ${b.is_active
                  ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                }`}>
                  {b.is_active ? t.admin.on : t.admin.off}
                </Badge>

                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon-xs" onClick={() => move(b.id, "up")} disabled={idx === 0}>
                    <ChevronUp size={14} className="text-zinc-500" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => move(b.id, "down")} disabled={idx === banners.length - 1}>
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
              {editingId ? t.admin.editBanner : t.admin.addBanner}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1">
            {/* Image upload */}
            <div className="space-y-2">
              <Label>{t.admin.photoLabel}</Label>
              <div
                onClick={() => fileRef.current?.click()}
                className="w-full h-36 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-violet-500 dark:hover:border-violet-500 cursor-pointer transition-colors bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center overflow-hidden"
              >
                {form.imagePreview ? (
                  <img src={form.imagePreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                    <ImageIcon size={24} />
                    <span className="text-xs">{t.admin.uploadPhoto}</span>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.admin.bannerTitleLabel}</Label>
              <Input
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Акции этой недели"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.admin.bannerLinkLabel}</Label>
              <Input
                type="url"
                value={form.link_url}
                onChange={e => setForm(prev => ({ ...prev, link_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label>{t.admin.bannerActive}</Label>
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
