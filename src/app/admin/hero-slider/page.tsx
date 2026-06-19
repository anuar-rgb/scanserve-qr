"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ImageIcon, Film, ChevronUp, ChevronDown, X } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import { useTranslations } from "@/lib/i18n";
import type { DbHeroSlide, SlideTag } from "@/lib/db-types";
import { uploadMedia } from "@/services/storage";
import { RESTAURANT_ID } from "@/constants";
import { ImageCropModal } from "@/components/admin/ImageCropModal";
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

const TAG_RECENT_KEY = "scanserve_recent_tag_colors";

const TAG_COLORS: Record<string, { bg: string; fg: string }> = {
  white:  { bg: "#FFFFFF", fg: "#111111" },
  yellow: { bg: "#F59E0B", fg: "#1C0F00" },
  green:  { bg: "#00C882", fg: "#001A0F" },
  red:    { bg: "#FF4D6D", fg: "#ffffff" },
  blue:   { bg: "#00AAFF", fg: "#ffffff" },
  orange: { bg: "#FF6B2B", fg: "#ffffff" },
  purple: { bg: "#A855F7", fg: "#ffffff" },
};

function resolveTagBg(color: string): string {
  if (color.startsWith("#")) return color;
  return TAG_COLORS[color]?.bg ?? "#ffffff";
}

function resolveTagColors(color: string): { bg: string; fg: string } {
  if (color.startsWith("#")) {
    const h = color.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return { bg: color, fg: (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#111111" : "#ffffff" };
  }
  return TAG_COLORS[color] ?? TAG_COLORS.white;
}

type SlideForm = {
  title: string;
  description: string;
  tags: SlideTag[];
  is_active: boolean;
  mediaFile: File | null;
  croppedBlob: Blob | null;
  mediaPreview: string | null;
  mediaType: "image" | "video";
  titleFontSize: number;
  descFontSize: number;
};

const FONT_PRESETS = [
  { label: "S", titlePx: 16, descPx: 11 },
  { label: "M", titlePx: 19, descPx: 13 },
  { label: "L", titlePx: 24, descPx: 16 },
  { label: "XL", titlePx: 30, descPx: 18 },
];

const EMPTY_FORM: SlideForm = {
  title: "", description: "", tags: [], is_active: true,
  mediaFile: null, croppedBlob: null, mediaPreview: null, mediaType: "image",
  titleFontSize: 19, descFontSize: 13,
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
  const [cropSrc, setCropSrc]     = useState<string | null>(null);
  const [tagPickerOpen, setTagPickerOpen] = useState<number | null>(null);
  const [tagRecentColors, setTagRecentColors] = useState<string[]>([]);

  useEffect(() => {
    try {
      const s = localStorage.getItem(TAG_RECENT_KEY);
      if (s) setTagRecentColors(JSON.parse(s));
    } catch {}
  }, []);

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
    setTagPickerOpen(null);
    setModalOpen(true);
  }

  function openEdit(s: DbHeroSlide) {
    setEditingId(s.id);
    setForm({
      title: s.title ?? "",
      description: s.description ?? "",
      tags: s.tags ?? [],
      is_active: s.is_active,
      mediaFile: null,
      croppedBlob: null,
      mediaPreview: s.url,
      mediaType: s.type,
      titleFontSize: s.title_font_size ?? 19,
      descFontSize: s.description_font_size ?? 13,
    });
    setTagPickerOpen(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTagPickerOpen(null);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    const isVideo = f.type.startsWith("video/");
    if (isVideo) {
      setForm(prev => ({
        ...prev,
        mediaFile: f,
        croppedBlob: null,
        mediaPreview: URL.createObjectURL(f),
        mediaType: "video",
      }));
    } else {
      setForm(prev => ({ ...prev, mediaFile: f, mediaType: "image" }));
      setCropSrc(URL.createObjectURL(f));
    }
  }

  function onCropApply(blob: Blob, previewUrl: string) {
    setForm(prev => ({ ...prev, croppedBlob: blob, mediaPreview: previewUrl }));
    setCropSrc(null);
  }

  function onCropCancel() {
    setCropSrc(null);
    setForm(prev => ({ ...prev, mediaFile: null }));
  }

  function addTag() {
    setForm(prev => ({ ...prev, tags: [...prev.tags, { text: "", color: "#A855F7" }] }));
  }

  function removeTag(i: number) {
    setForm(prev => ({ ...prev, tags: prev.tags.filter((_, j) => j !== i) }));
    if (tagPickerOpen === i) setTagPickerOpen(null);
  }

  function updateTagText(i: number, text: string) {
    setForm(prev => ({ ...prev, tags: prev.tags.map((t, j) => j === i ? { ...t, text } : t) }));
  }

  function updateTagColor(i: number, color: string) {
    setForm(prev => ({ ...prev, tags: prev.tags.map((t, j) => j === i ? { ...t, color } : t) }));
    if (color.startsWith("#")) {
      const c = color.toUpperCase();
      setTagRecentColors(prev => {
        const updated = [c, ...prev.filter(x => x !== c)].slice(0, 12);
        try { localStorage.setItem(TAG_RECENT_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      });
    }
  }

  async function handleSave() {
    if (!isConfigured) { toast.error("Database not configured"); return; }
    setSaving(true);
    try {
      let url: string | null = editingId
        ? (slides.find(s => s.id === editingId)?.url ?? null)
        : null;
      let type: "image" | "video" = form.mediaType;

      if (form.croppedBlob) {
        const file = new File([form.croppedBlob], `slide-${Date.now()}.jpg`, { type: "image/jpeg" });
        const result = await uploadMedia(file, "heroSlides", "slide");
        url = result.url;
        type = "image";
      } else if (form.mediaFile) {
        const result = await uploadMedia(form.mediaFile, "heroSlides", "slide");
        url = result.url;
        type = result.type;
      }

      if (!url) {
        toast.error("Please upload an image or video");
        return;
      }

      const cleanTags = form.tags.filter(t => t.text.trim());

      const payload = {
        restaurant_id: RESTAURANT_ID,
        type,
        url,
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        tags: cleanTags.length > 0 ? cleanTags : null,
        is_active: form.is_active,
        title_font_size: form.titleFontSize !== 19 ? form.titleFontSize : null,
        description_font_size: form.descFontSize !== 13 ? form.descFontSize : null,
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
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <Badge className="text-[10px] px-1.5 py-0 border-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                      {s.type}
                    </Badge>
                    {s.tags?.slice(0, 3).map((tag, i) => {
                      const c = resolveTagColors(tag.color);
                      return (
                        <span
                          key={i}
                          className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: c.bg, color: c.fg }}
                        >
                          {tag.text}
                        </span>
                      );
                    })}
                  </div>
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

      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          aspect={4 / 5}
          mimeType="image/jpeg"
          onApply={onCropApply}
          onCancel={onCropCancel}
        />
      )}

      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-[860px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t.admin.editSlide : t.admin.addSlide}
            </DialogTitle>
          </DialogHeader>

          {/* Two-column layout: form + live preview */}
          <div className="flex gap-6 min-h-0">
            {/* Left: form */}
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[60vh] pr-1 min-w-0">
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

            {/* Font size preset */}
            <div className="space-y-1.5">
              <Label>Размер шрифта</Label>
              <div className="flex gap-1.5">
                {FONT_PRESETS.map(p => {
                  const active = form.titleFontSize === p.titlePx;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, titleFontSize: p.titlePx, descFontSize: p.descPx }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        active
                          ? "bg-violet-600 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-violet-600"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Multi-tag editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t.admin.slideTagLabel}</Label>
                <button
                  type="button"
                  onClick={addTag}
                  className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                >
                  <Plus size={12} />
                  {t.admin.addTag}
                </button>
              </div>

              {form.tags.length === 0 && (
                <p className="text-xs text-zinc-400 dark:text-zinc-600 italic">Нет тегов</p>
              )}

              {form.tags.map((tag, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={tag.text}
                      onChange={e => updateTagText(i, e.target.value)}
                      placeholder="Вкусно!"
                      className="flex-1 h-8 text-sm"
                    />
                    {/* Color swatch — click to open picker */}
                    <button
                      type="button"
                      onClick={() => setTagPickerOpen(tagPickerOpen === i ? null : i)}
                      title="Выбрать цвет"
                      className="w-7 h-7 rounded-md shrink-0 transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        background: resolveTagBg(tag.color),
                        border: tagPickerOpen === i
                          ? "2px solid #7c3aed"
                          : "2px solid rgba(0,0,0,0.15)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeTag(i)}
                      className="shrink-0 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Inline color picker */}
                  {tagPickerOpen === i && (
                    <TagColorPicker
                      color={resolveTagBg(tag.color)}
                      recentColors={tagRecentColors}
                      onChange={hex => updateTagColor(i, hex)}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between py-1">
              <Label>{t.admin.slideActive}</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
            </div>

            {/* Right: phone preview */}
            <div className="w-52 shrink-0 flex flex-col items-center gap-3 pt-1">
              <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest self-start">
                Preview
              </p>
              <SliderPhoneMockup
                title={form.title}
                description={form.description}
                tags={form.tags}
                mediaPreview={form.mediaPreview}
                mediaType={form.mediaType}
                titleFontSize={form.titleFontSize}
                descFontSize={form.descFontSize}
              />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">
                Так выглядит слайд в меню гостя
              </p>
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

// ── Tag Color Picker ──────────────────────────────────────────────────────────

function TagColorPicker({
  color,
  recentColors,
  onChange,
}: {
  color: string;
  recentColors: string[];
  onChange: (hex: string) => void;
}) {
  const [hexInput, setHexInput] = useState(color.toUpperCase());

  useEffect(() => {
    setHexInput(color.toUpperCase());
  }, [color]);

  function handleHexInput(val: string) {
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) onChange(val);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3 shadow-sm">
      <HexColorPicker color={color} onChange={onChange} style={{ width: "100%" }} />
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded border border-border shrink-0 transition-colors"
          style={{ background: color }}
        />
        <Input
          value={hexInput}
          onChange={e => handleHexInput(e.target.value)}
          className="font-mono text-xs h-7"
          maxLength={7}
          placeholder="#ffffff"
        />
      </div>
      {recentColors.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5">Недавние</p>
          <div className="flex flex-wrap gap-1">
            {recentColors.map((c, i) => (
              <button
                key={i}
                type="button"
                title={c}
                onClick={() => onChange(c)}
                className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Slider phone mockup ───────────────────────────────────────────────────────

function SliderPhoneMockup({
  title, description, tags, mediaPreview, mediaType, titleFontSize = 19, descFontSize = 13,
}: {
  title: string; description: string; tags: SlideTag[];
  mediaPreview: string | null; mediaType: "image" | "video";
  titleFontSize?: number; descFontSize?: number;
}) {
  const visibleTags = tags.filter(t => t.text.trim());
  return (
    <div style={{
      width: 196,
      background: "#1C1C1E",
      borderRadius: 36,
      padding: "18px 9px 14px",
      boxShadow: "inset 0 0 0 1.5px #3a3a3c, 0 12px 32px rgba(0,0,0,0.4)",
      flexShrink: 0,
    }}>
      {/* Pill notch */}
      <div style={{ width: 52, height: 7, background: "#2c2c2e", borderRadius: 99, margin: "0 auto 10px" }} />
      {/* Screen */}
      <div style={{ background: "#F5F5F7", borderRadius: 20, overflow: "hidden" }}>
        {/* Slider — 4:5 portrait, edge-to-edge */}
        <div style={{
          width: "100%",
          aspectRatio: "4 / 5",
          position: "relative",
          overflow: "hidden",
          background: "#ccc",
          borderRadius: "0 0 16px 16px",
        } as React.CSSProperties}>
          {mediaPreview ? (
            mediaType === "video" ? (
              <video src={mediaPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
            ) : (
              <img src={mediaPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "#aaa" }}>
              🖼️
            </div>
          )}

          {/* Floating glass header */}
          <div style={{
            position: "absolute", top: 6, left: 5, right: 5,
            background: "rgba(11,11,17,0.72)",
            backdropFilter: "blur(14px)",
            borderRadius: 8,
            padding: "4px 8px",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <div style={{ width: 18, height: 18, borderRadius: 6, background: "#444", flexShrink: 0 }} />
            <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.3)", borderRadius: 3 }} />
            <div style={{ width: 12, height: 12, borderRadius: 99, background: "rgba(255,255,255,0.2)" }} />
          </div>

          {/* Tags + title at bottom */}
          <div style={{ position: "absolute", bottom: 9, left: 8, right: 8 }}>
            {visibleTags.length > 0 && (
              <div style={{ display: "flex", gap: 3, marginBottom: 4, flexWrap: "wrap" }}>
                {visibleTags.map((tag, i) => {
                  const c = resolveTagColors(tag.color);
                  return (
                    <span key={i} style={{
                      background: c.bg, color: c.fg,
                      fontSize: 6, fontWeight: 800,
                      padding: "2px 5px", borderRadius: 99,
                      fontFamily: "'Montserrat', system-ui, sans-serif",
                    }}>{tag.text}</span>
                  );
                })}
              </div>
            )}
            {title && (
              <p style={{
                color: "#fff", fontWeight: 800, fontSize: titleFontSize * 0.47, margin: 0,
                textShadow: "0 1px 8px rgba(0,0,0,0.65), 0 2px 20px rgba(0,0,0,0.35)",
                fontFamily: "'Montserrat', system-ui, sans-serif",
                lineHeight: 1.3,
              }}>{title}</p>
            )}
            {description && (
              <p style={{
                color: "rgba(255,255,255,0.85)", fontWeight: 500, fontSize: descFontSize * 0.54, margin: "2px 0 0",
                textShadow: "0 1px 8px rgba(0,0,0,0.65)",
                fontFamily: "'Montserrat', system-ui, sans-serif",
              }}>{description}</p>
            )}
          </div>

          {/* Slide dots */}
          <div style={{ position: "absolute", bottom: 9, right: 8, display: "flex", gap: 3, alignItems: "center" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: i === 0 ? 10 : 3, height: 3, borderRadius: 99,
                background: i === 0 ? "#fff" : "rgba(255,255,255,0.45)",
              }} />
            ))}
          </div>
        </div>

        {/* Below slider — simulated info cards */}
        <div style={{ padding: "8px 8px 10px" }}>
          <div style={{ display: "flex", gap: 5, marginBottom: 7 }}>
            {["🍽️", "⭐", "🎁"].map((emoji, i) => (
              <div key={i} style={{
                flex: 1, background: "#fff", borderRadius: 10, padding: "5px 4px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                border: "1px solid rgba(0,0,0,0.07)",
              }}>
                <span style={{ fontSize: 11 }}>{emoji}</span>
                <div style={{ width: "70%", height: 3, background: "#e0e0e0", borderRadius: 99 }} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {[0, 1].map(i => (
              <div key={i} style={{
                background: "#fff", borderRadius: 10, overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.07)",
              }}>
                <div style={{ aspectRatio: "1/1", background: "#e8e8e8" } as React.CSSProperties} />
                <div style={{ padding: "4px 5px" }}>
                  <div style={{ height: 3, width: "80%", background: "#d0d0d0", borderRadius: 3, marginBottom: 2 }} />
                  <div style={{ height: 3, width: "50%", background: "#c0c0c0", borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Home bar */}
      <div style={{ width: 62, height: 4, background: "#3a3a3c", borderRadius: 99, margin: "9px auto 0" }} />
    </div>
  );
}
