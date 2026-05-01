"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ImageIcon, Film, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import { useTranslations } from "@/lib/i18n";
import type { DbHeroSlide } from "@/lib/db-types";
import { uploadMedia } from "@/services/storage";
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

type SlideForm = {
  title: string;
  description: string;
  tag: string;
  tag_color: "white" | "yellow";
  is_active: boolean;
  mediaFile: File | null;
  mediaPreview: string | null;
  mediaType: "image" | "video";
};

const EMPTY_FORM: SlideForm = {
  title: "", description: "", tag: "", tag_color: "white", is_active: true,
  mediaFile: null, mediaPreview: null, mediaType: "image",
};

export default function HeroSliderPage() {
  const { t } = useTranslations();
  const fileRef = useRef<HTMLInputElement>(null);

  const [slides, setSlides]       = useState<DbHeroSlide[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState<SlideForm>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("hero_slides")
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .order("order_index");
    if (data) setSlides(data as DbHeroSlide[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(s: DbHeroSlide) {
    setEditingId(s.id);
    setForm({
      title: s.title ?? "",
      description: s.description ?? "",
      tag: s.tag ?? "",
      tag_color: s.tag_color ?? "white",
      is_active: s.is_active,
      mediaFile: null,
      mediaPreview: s.url,
      mediaType: s.type,
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
    const isVideo = f.type.startsWith("video/");
    setForm(prev => ({
      ...prev,
      mediaFile: f,
      mediaPreview: URL.createObjectURL(f),
      mediaType: isVideo ? "video" : "image",
    }));
  }

  async function handleSave() {
    if (!isConfigured) { toast.error("Database not configured"); return; }
    setSaving(true);
    try {
      let url: string | null = editingId
        ? (slides.find(s => s.id === editingId)?.url ?? null)
        : null;
      let type: "image" | "video" = form.mediaType;

      if (form.mediaFile) {
        const result = await uploadMedia(form.mediaFile, "heroSlides", "slide");
        url = result.url;
        type = result.type;
      }

      if (!url) {
        toast.error("Please upload an image or video");
        return;
      }

      const payload = {
        restaurant_id: RESTAURANT_ID,
        type,
        url,
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        tag: form.tag.trim() || null,
        tag_color: form.tag.trim() ? form.tag_color : null,
        is_active: form.is_active,
      };

      if (editingId) {
        await supabase.from("hero_slides").update(payload).eq("id", editingId);
      } else {
        const maxOrder = slides.length > 0 ? Math.max(...slides.map(s => s.order_index)) + 1 : 0;
        await supabase.from("hero_slides").insert({ ...payload, order_index: maxOrder });
      }

      await load();
      closeModal();
      toast.success(t.admin.slideSaved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save slide");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!isConfigured) return;
    setDeleting(id);
    const { error } = await supabase.from("hero_slides").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete slide");
    } else {
      setSlides(prev => prev.filter(s => s.id !== id));
      toast.success("Slide deleted");
    }
    setDeleting(null);
  }

  async function toggleActive(s: DbHeroSlide) {
    if (!isConfigured) return;
    const next = !s.is_active;
    setSlides(prev => prev.map(x => x.id === s.id ? { ...x, is_active: next } : x));
    await supabase.from("hero_slides").update({ is_active: next }).eq("id", s.id);
  }

  async function move(id: string, direction: "up" | "down") {
    if (!isConfigured) return;
    const idx = slides.findIndex(s => s.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === slides.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const updated = [...slides];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    const reindexed = updated.map((s, i) => ({ ...s, order_index: i }));
    setSlides(reindexed);
    await Promise.all(
      reindexed.map(s => supabase.from("hero_slides").update({ order_index: s.order_index }).eq("id", s.id))
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/60 shrink-0 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.admin.heroSliderTitle}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{t.admin.descHeroSlider}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus />
          {t.admin.addSlide}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-zinc-400 text-sm">
            <Loader2 size={16} className="animate-spin" />
            {t.admin.loadingCatalog}
          </div>
        ) : slides.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-zinc-400">
            <Film size={32} strokeWidth={1.5} />
            <p className="text-sm">{t.admin.noSlides}</p>
            <Button variant="link" onClick={openCreate} className="text-violet-500 hover:text-violet-600 p-0 h-auto">
              + {t.admin.addSlide}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {slides.map((s, idx) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30"
              >
                {/* Thumbnail */}
                <div className="w-20 h-12 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center relative">
                  {s.type === "video" ? (
                    <>
                      <video src={s.url} className="w-full h-full object-cover" muted />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Film size={14} className="text-white" />
                      </div>
                    </>
                  ) : s.url ? (
                    <img src={s.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={16} className="text-zinc-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {s.title || <span className="text-zinc-400 italic">No title</span>}
                  </p>
                  {s.description && (
                    <p className="text-xs text-zinc-400 truncate">{s.description}</p>
                  )}
                  <Badge className="mt-1 text-[10px] px-1.5 py-0 border-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                    {s.type}
                  </Badge>
                </div>

                <button
                  onClick={() => toggleActive(s)}
                  className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border-0 transition-colors ${
                    s.is_active
                      ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {s.is_active ? t.admin.on : t.admin.off}
                </button>

                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon-xs" onClick={() => move(s.id, "up")} disabled={idx === 0}>
                    <ChevronUp size={14} className="text-zinc-500" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => move(s.id, "down")} disabled={idx === slides.length - 1}>
                    <ChevronDown size={14} className="text-zinc-500" />
                  </Button>
                </div>

                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)}>
                  <Pencil size={14} className="text-zinc-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(s.id)}
                  disabled={deleting === s.id}
                  className="hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  {deleting === s.id
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
              {editingId ? t.admin.editSlide : t.admin.addSlide}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1">
            {/* Media upload */}
            <div className="space-y-2">
              <Label>{t.admin.photoLabel}</Label>
              <div
                onClick={() => fileRef.current?.click()}
                className="w-full h-40 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-violet-500 dark:hover:border-violet-500 cursor-pointer transition-colors bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center overflow-hidden"
              >
                {form.mediaPreview ? (
                  form.mediaType === "video" ? (
                    <video src={form.mediaPreview} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={form.mediaPreview} alt="" className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                    <Film size={24} />
                    <span className="text-xs text-center px-4">{t.admin.uploadVideo}</span>
                  </div>
                )}
              </div>
              {form.mediaPreview && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-violet-500 hover:text-violet-600"
                >
                  {t.admin.changeMedia}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.admin.slideTitleLabel}</Label>
              <Input
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="АС ТӨРІ"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.admin.slideDescLabel}</Label>
              <Input
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Завтраки | Пицца | Бургеры"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.admin.slideTagLabel}</Label>
              <Input
                value={form.tag}
                onChange={e => setForm(prev => ({ ...prev, tag: e.target.value }))}
                placeholder="Вкусно!"
              />
            </div>

            {form.tag && (
              <div className="space-y-1.5">
                <Label>{t.admin.slideTagColorLabel}</Label>
                <div className="flex gap-2">
                  {(["white", "yellow"] as const).map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, tag_color: color }))}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        form.tag_color === color
                          ? "border-violet-500 ring-1 ring-violet-500"
                          : "border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-600"
                        style={{ background: color === "yellow" ? "#F9D94A" : "#fff" }}
                      />
                      {color === "yellow" ? "Жёлтый" : "Белый"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between py-1">
              <Label>{t.admin.slideActive}</Label>
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
