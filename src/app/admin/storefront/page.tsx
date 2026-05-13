"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, Loader2, ImageIcon, Plus, Pencil, Trash2, Film,
  ChevronUp, ChevronDown, X, LayoutGrid, Search, Star,
} from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import { useTranslations } from "@/lib/i18n";
import type { DbRestaurant, DbHeroSlide, SlideTag, DbInfoShowcase, DbBanner, DbProduct } from "@/lib/db-types";
import { uploadImage, uploadMedia } from "@/services/storage";
import { RESTAURANT_ID } from "@/constants";
import { ImageCropModal } from "@/components/admin/ImageCropModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// ── TAG helpers (shared by HeroSliderSection) ─────────────────────────────────

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

// ── Slide form ────────────────────────────────────────────────────────────────

type SlideForm = {
  title: string;
  description: string;
  tags: SlideTag[];
  is_active: boolean;
  mediaFile: File | null;
  croppedBlob: Blob | null;
  mediaPreview: string | null;
  mediaType: "image" | "video";
};

const EMPTY_SLIDE: SlideForm = {
  title: "", description: "", tags: [], is_active: true,
  mediaFile: null, croppedBlob: null, mediaPreview: null, mediaType: "image",
};

// ── Showcase form ─────────────────────────────────────────────────────────────

type ShowcaseForm = { title: string; emoji: string; is_active: boolean };
const EMPTY_SHOWCASE: ShowcaseForm = { title: "", emoji: "✨", is_active: true };

// ── Banner form ───────────────────────────────────────────────────────────────

type BannerForm = {
  title: string;
  link_url: string;
  is_active: boolean;
  imageFile: File | null;
  imagePreview: string | null;
};

const EMPTY_BANNER: BannerForm = {
  title: "", link_url: "", is_active: true,
  imageFile: null, imagePreview: null,
};

// ── Tab type ──────────────────────────────────────────────────────────────────

type TabKey = "branding" | "slider" | "showcase" | "banners" | "recommendations";

// ═══════════════════════════════════════════════════════════════════════════════
// Main page export
// ═══════════════════════════════════════════════════════════════════════════════

export default function StorefrontPage() {
  const { t } = useTranslations();
  const [tab, setTab] = useState<TabKey>("branding");

  return (
    <div className="flex flex-col h-full">
      <header className="px-8 py-5 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold">{t.admin.navMainScreen}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{t.admin.descMainScreen}</p>
      </header>

      <div className="px-8 pt-4 pb-0 border-b border-border shrink-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList variant="line">
            <TabsTrigger value="branding">{t.admin.navBranding}</TabsTrigger>
            <TabsTrigger value="slider">{t.admin.navHeroSlider}</TabsTrigger>
            <TabsTrigger value="showcase">{t.admin.navInfoShowcase}</TabsTrigger>
            <TabsTrigger value="banners">{t.admin.navBanners}</TabsTrigger>
            <TabsTrigger value="recommendations">{t.admin.navRecommendations}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === "branding"         && <BrandingSection />}
        {tab === "slider"           && <HeroSliderSection />}
        {tab === "showcase"         && <InfoShowcaseSection />}
        {tab === "banners"          && <BannersSection />}
        {tab === "recommendations"  && <RecommendationsSection />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 1 — Branding
// ═══════════════════════════════════════════════════════════════════════════════

function BrandingSection() {
  const { t } = useTranslations();
  const logoRef = useRef<HTMLInputElement>(null);

  const [restaurant, setRestaurant] = useState<DbRestaurant | null>(null);
  const [loading, setLoading]       = useState(true);
  const [name, setName]             = useState("");
  const [description, setDescription] = useState("");
  const [waNumber, setWaNumber]     = useState("");
  const [logoFile, setLogoFile]     = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [cropSrc, setCropSrc]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    const { data } = await supabase
      .from("restaurants").select("*").eq("id", RESTAURANT_ID).single();
    if (data) {
      const r = data as DbRestaurant;
      setRestaurant(r);
      setName(r.name ?? "");
      setDescription(r.description ?? "");
      setWaNumber(r.wa_number ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCropSrc(URL.createObjectURL(f));
    e.target.value = "";
  }

  function handleCropApply(blob: Blob, url: string) {
    const file = new File([blob], `branding-logo-${Date.now()}.jpg`, { type: blob.type });
    setLogoFile(file);
    setLogoPreview(url);
    setCropSrc(null);
  }

  async function handleSave() {
    if (!isConfigured) { toast.error("Database not configured"); return; }
    setSaving(true);
    try {
      const updateData: {
        name: string; description: string | null; wa_number: string | null; logo?: string | null;
      } = {
        name: name.trim(),
        description: description.trim() || null,
        wa_number: waNumber.trim() || null,
      };

      if (logoFile) {
        updateData.logo = await uploadImage(logoFile, "branding", "logo");
        setLogoPreview(updateData.logo ?? null);
        setLogoFile(null);
      }

      const { data, error: dbErr } = await supabase
        .from("restaurants").update(updateData).eq("id", RESTAURANT_ID).select("id");

      if (dbErr)
        throw new Error(`${dbErr.code}: ${dbErr.message} — ${dbErr.details ?? dbErr.hint ?? ""}`);
      if (!data || data.length === 0)
        throw new Error("Запись не найдена или нет прав на изменение");

      setRestaurant((prev) => prev ? { ...prev, ...updateData } : null);
      toast.success(t.admin.brandingSaved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex gap-8 items-start" style={{ maxWidth: 920 }}>
        {/* Left: form cards */}
        <div className="flex-1 space-y-6 min-w-0">
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="animate-spin" /> : <Upload />}
              {saving ? t.admin.saving : t.admin.save}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t.admin.identitySection}</CardTitle>
              <CardDescription>{t.admin.descProfile}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="space-y-1.5">
                <Label htmlFor="rest-name">{t.admin.restaurantName}</Label>
                <Input
                  id="rest-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={restaurant?.name ?? ""}
                />
                <p className="text-xs text-muted-foreground">{t.admin.restaurantNameDesc}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rest-desc">Описание</Label>
                <textarea
                  id="rest-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Короткое описание ресторана для гостей…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <p className="text-xs text-muted-foreground">Отображается под названием в меню гостей.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wa-number">{t.admin.waNumber}</Label>
                <Input
                  id="wa-number"
                  value={waNumber}
                  onChange={(e) => setWaNumber(e.target.value)}
                  placeholder="+7 700 000 0000"
                />
                <p className="text-xs text-muted-foreground">{t.admin.waNumberDesc}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.admin.imagesSection}</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <UploadField
                label={t.admin.logoLabel}
                description={t.admin.logoDesc}
                aspect="square"
                currentUrl={logoPreview ?? restaurant?.logo ?? null}
                fileRef={logoRef}
                onChange={onLogoChange}
                uploadLabel={t.admin.uploadPhoto}
                changeLabel={t.admin.changePhoto}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: phone preview */}
        <div className="w-52 shrink-0 flex flex-col items-center gap-3 pt-11">
          <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest self-start">
            Preview
          </p>
          <BrandingPhoneMockup
            name={name}
            description={description}
            logoPreview={logoPreview ?? restaurant?.logo ?? null}
          />
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">
            Так выглядит шапка в меню гостя
          </p>
        </div>
      </div>

      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          aspect={1}
          mimeType="image/jpeg"
          onApply={handleCropApply}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}

// ── Upload field ──────────────────────────────────────────────────────────────

function UploadField({
  label, description, aspect, currentUrl, fileRef, onChange, uploadLabel, changeLabel,
}: {
  label: string;
  description: string;
  aspect: "square" | "wide";
  currentUrl: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadLabel: string;
  changeLabel: string;
}) {
  const isWide = aspect === "wide";
  return (
    <div className="flex gap-5 items-start">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`shrink-0 rounded-xl overflow-hidden border-2 border-dashed border-border hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer transition-colors bg-muted/40 flex items-center justify-center ${
          isWide ? "w-52 h-28" : "w-24 h-24"
        }`}
      >
        {currentUrl ? (
          <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground pointer-events-none">
            <ImageIcon size={20} />
            <span className="text-[11px]">{uploadLabel}</span>
          </div>
        )}
      </button>
      <div className="flex-1 pt-1 space-y-2">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload />
          {currentUrl ? changeLabel : uploadLabel}
        </Button>
        <p className="text-[11px] text-muted-foreground">PNG, JPG, WebP — max 5 MB</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onChange}
        />
      </div>
    </div>
  );
}

// ── Branding phone mockup ─────────────────────────────────────────────────────

function BrandingPhoneMockup({
  name, description, logoPreview,
}: {
  name: string; description: string; logoPreview: string | null;
}) {
  return (
    <div style={{
      width: 196,
      background: "#1C1C1E",
      borderRadius: 36,
      padding: "18px 9px 14px",
      boxShadow: "inset 0 0 0 1.5px #3a3a3c, 0 12px 32px rgba(0,0,0,0.4)",
      flexShrink: 0,
    }}>
      <div style={{ width: 52, height: 7, background: "#2c2c2e", borderRadius: 99, margin: "0 auto 10px" }} />
      <div style={{ background: "#F5F5F7", borderRadius: 20, overflow: "hidden" }}>
        <div style={{ position: "relative", height: 100, overflow: "hidden", background: "linear-gradient(135deg, #3b1f6e 0%, #1a1a2e 60%, #16213e 100%)" }}>
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <div style={{ fontSize: 20, opacity: 0.6 }}>▶</div>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.45)", fontFamily: "system-ui", letterSpacing: 1 }}>СЛАЙДЕР</div>
          </div>
          <div style={{
            position: "absolute", top: 6, left: 5, right: 5,
            background: "rgba(11,11,17,0.72)",
            backdropFilter: "blur(14px)",
            borderRadius: 8, padding: "5px 8px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 7, overflow: "hidden",
              background: "#3a3a3c", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {logoPreview
                ? <img src={logoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 11, lineHeight: 1 }}>🍽</span>
              }
            </div>
            <p style={{
              flex: 1, margin: 0, color: "#fff",
              fontSize: 8, fontWeight: 700,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontFamily: "'Montserrat', system-ui, sans-serif",
            }}>
              {name || "Название ресторана"}
            </p>
            <div style={{ width: 14, height: 14, borderRadius: 99, background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
          </div>
        </div>
        <div style={{ padding: "8px 8px 10px" }}>
          {description && (
            <p style={{
              fontSize: 6.5, color: "#666", marginBottom: 7, lineHeight: 1.4,
              fontFamily: "system-ui", overflow: "hidden",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            } as React.CSSProperties}>
              {description}
            </p>
          )}
          <div style={{ display: "flex", gap: 4, marginBottom: 8, overflow: "hidden" }}>
            {["Всё", "Пицца", "Бургеры", "Напитки"].map((cat, i) => (
              <div key={i} style={{
                padding: "3px 8px", borderRadius: 99,
                background: i === 0 ? "#8B5CF6" : "#e0e0e0",
                fontSize: 6, fontWeight: 700,
                color: i === 0 ? "#fff" : "#666",
                whiteSpace: "nowrap",
                fontFamily: "'Montserrat', system-ui, sans-serif",
              }}>{cat}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)" }}>
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
      <div style={{ width: 62, height: 4, background: "#3a3a3c", borderRadius: 99, margin: "9px auto 0" }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 2 — Hero Slider
// ═══════════════════════════════════════════════════════════════════════════════

function HeroSliderSection() {
  const { t } = useTranslations();
  const fileRef = useRef<HTMLInputElement>(null);

  const [slides, setSlides]         = useState<DbHeroSlide[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<SlideForm>(EMPTY_SLIDE);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [cropSrc, setCropSrc]       = useState<string | null>(null);
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
      .from("hero_slides").select("*").eq("restaurant_id", RESTAURANT_ID).order("order_index");
    if (data) setSlides(data as DbHeroSlide[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_SLIDE);
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
    });
    setTagPickerOpen(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_SLIDE);
    setTagPickerOpen(null);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    const isVideo = f.type.startsWith("video/");
    if (isVideo) {
      setForm(prev => ({ ...prev, mediaFile: f, croppedBlob: null, mediaPreview: URL.createObjectURL(f), mediaType: "video" }));
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
    setForm(prev => ({ ...prev, tags: prev.tags.map((tg, j) => j === i ? { ...tg, text } : tg) }));
  }

  function updateTagColor(i: number, color: string) {
    setForm(prev => ({ ...prev, tags: prev.tags.map((tg, j) => j === i ? { ...tg, color } : tg) }));
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
      let url: string | null = editingId ? (slides.find(s => s.id === editingId)?.url ?? null) : null;
      let type: "image" | "video" = form.mediaType;

      if (form.croppedBlob) {
        const file = new File([form.croppedBlob], `slide-${Date.now()}.jpg`, { type: "image/jpeg" });
        const result = await uploadMedia(file, "heroSlides", "slide");
        url = result.url; type = "image";
      } else if (form.mediaFile) {
        const result = await uploadMedia(form.mediaFile, "heroSlides", "slide");
        url = result.url; type = result.type;
      }

      if (!url) { toast.error("Please upload an image or video"); return; }

      const cleanTags = form.tags.filter(tg => tg.text.trim());
      const payload = {
        restaurant_id: RESTAURANT_ID,
        type, url,
        title: form.title.trim() || null,
        description: form.description.trim() || null,
        tags: cleanTags.length > 0 ? cleanTags : null,
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
    if (error) { toast.error("Failed to delete slide"); }
    else { setSlides(prev => prev.filter(s => s.id !== id)); toast.success("Slide deleted"); }
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
      <div className="px-8 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t.admin.descHeroSlider}</p>
        <Button onClick={openCreate} size="sm">
          <Plus />
          {t.admin.addSlide}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground text-sm">
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
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
              >
                <div className="w-20 h-12 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center relative">
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
                    <ImageIcon size={16} className="text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {s.title || <span className="text-muted-foreground italic">No title</span>}
                  </p>
                  {s.description && (
                    <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                  )}
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <Badge className="text-[10px] px-1.5 py-0 border-0 bg-muted text-muted-foreground">
                      {s.type}
                    </Badge>
                    {s.tags?.slice(0, 3).map((tag, i) => {
                      const c = resolveTagColors(tag.color);
                      return (
                        <span key={i} className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: c.bg, color: c.fg }}>
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
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.is_active ? t.admin.on : t.admin.off}
                </button>

                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon-xs" onClick={() => move(s.id, "up")} disabled={idx === 0}>
                    <ChevronUp size={14} className="text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => move(s.id, "down")} disabled={idx === slides.length - 1}>
                    <ChevronDown size={14} className="text-muted-foreground" />
                  </Button>
                </div>

                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)}>
                  <Pencil size={14} className="text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost" size="icon-sm"
                  onClick={() => handleDelete(s.id)}
                  disabled={deleting === s.id}
                  className="hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  {deleting === s.id
                    ? <Loader2 size={14} className="animate-spin text-muted-foreground" />
                    : <Trash2 size={14} className="text-red-500 dark:text-red-400" />}
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

          <div className="flex gap-6 min-h-0">
            {/* Left: form */}
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[60vh] pr-1 min-w-0">
              <div className="space-y-2">
                <Label>{t.admin.photoLabel}</Label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-40 rounded-xl border-2 border-dashed border-border hover:border-violet-500 cursor-pointer transition-colors bg-muted/50 flex items-center justify-center overflow-hidden"
                >
                  {form.mediaPreview ? (
                    form.mediaType === "video"
                      ? <video src={form.mediaPreview} className="w-full h-full object-cover" muted />
                      : <img src={form.mediaPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Film size={24} />
                      <span className="text-xs text-center px-4">{t.admin.uploadVideo}</span>
                    </div>
                  )}
                </div>
                {form.mediaPreview && (
                  <button onClick={() => fileRef.current?.click()} className="text-xs text-violet-500 hover:text-violet-600">
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t.admin.slideTagLabel}</Label>
                  <button
                    type="button"
                    onClick={addTag}
                    className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
                  >
                    <Plus size={12} />
                    {t.admin.addTag}
                  </button>
                </div>
                {form.tags.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Нет тегов</p>
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
                      <button
                        type="button"
                        onClick={() => setTagPickerOpen(tagPickerOpen === i ? null : i)}
                        className="w-7 h-7 rounded-md shrink-0 transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{
                          background: resolveTagBg(tag.color),
                          border: tagPickerOpen === i ? "2px solid #7c3aed" : "2px solid rgba(0,0,0,0.15)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeTag(i)}
                        className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
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
              />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">
                Так выглядит слайд в меню гостя
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>{t.admin.cancel}</Button>
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
  color, recentColors, onChange,
}: {
  color: string; recentColors: string[]; onChange: (hex: string) => void;
}) {
  const [hexInput, setHexInput] = useState(color.toUpperCase());

  useEffect(() => { setHexInput(color.toUpperCase()); }, [color]);

  function handleHexInput(val: string) {
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) onChange(val);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3 shadow-sm">
      <HexColorPicker color={color} onChange={onChange} style={{ width: "100%" }} />
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded border border-border shrink-0 transition-colors" style={{ background: color }} />
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
  title, description, tags, mediaPreview, mediaType,
}: {
  title: string; description: string; tags: SlideTag[];
  mediaPreview: string | null; mediaType: "image" | "video";
}) {
  const visibleTags = tags.filter(tg => tg.text.trim());
  return (
    <div style={{
      width: 196, background: "#1C1C1E", borderRadius: 36,
      padding: "18px 9px 14px",
      boxShadow: "inset 0 0 0 1.5px #3a3a3c, 0 12px 32px rgba(0,0,0,0.4)",
      flexShrink: 0,
    }}>
      <div style={{ width: 52, height: 7, background: "#2c2c2e", borderRadius: 99, margin: "0 auto 10px" }} />
      <div style={{ background: "#F5F5F7", borderRadius: 20, overflow: "hidden" }}>
        <div style={{
          width: "100%", aspectRatio: "4 / 5", position: "relative", overflow: "hidden",
          background: "#ccc", borderRadius: "0 0 16px 16px",
        } as React.CSSProperties}>
          {mediaPreview ? (
            mediaType === "video"
              ? <video src={mediaPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
              : <img src={mediaPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "#aaa" }}>🖼️</div>
          )}
          <div style={{
            position: "absolute", top: 6, left: 5, right: 5,
            background: "rgba(11,11,17,0.72)", backdropFilter: "blur(14px)",
            borderRadius: 8, padding: "4px 8px",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <div style={{ width: 18, height: 18, borderRadius: 6, background: "#444", flexShrink: 0 }} />
            <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.3)", borderRadius: 3 }} />
            <div style={{ width: 12, height: 12, borderRadius: 99, background: "rgba(255,255,255,0.2)" }} />
          </div>
          <div style={{ position: "absolute", bottom: 9, left: 8, right: 8 }}>
            {visibleTags.length > 0 && (
              <div style={{ display: "flex", gap: 3, marginBottom: 4, flexWrap: "wrap" }}>
                {visibleTags.map((tag, i) => {
                  const c = resolveTagColors(tag.color);
                  return (
                    <span key={i} style={{
                      background: c.bg, color: c.fg, fontSize: 6, fontWeight: 800,
                      padding: "2px 5px", borderRadius: 99,
                      fontFamily: "'Montserrat', system-ui, sans-serif",
                    }}>{tag.text}</span>
                  );
                })}
              </div>
            )}
            {title && (
              <p style={{
                color: "#fff", fontWeight: 800, fontSize: 9, margin: 0, lineHeight: 1.3,
                textShadow: "0 1px 8px rgba(0,0,0,0.65), 0 2px 20px rgba(0,0,0,0.35)",
                fontFamily: "'Montserrat', system-ui, sans-serif",
              }}>{title}</p>
            )}
            {description && (
              <p style={{
                color: "rgba(255,255,255,0.85)", fontWeight: 500, fontSize: 7, margin: "2px 0 0",
                textShadow: "0 1px 8px rgba(0,0,0,0.65)",
                fontFamily: "'Montserrat', system-ui, sans-serif",
              }}>{description}</p>
            )}
          </div>
          <div style={{ position: "absolute", bottom: 9, right: 8, display: "flex", gap: 3, alignItems: "center" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: i === 0 ? 10 : 3, height: 3, borderRadius: 99, background: i === 0 ? "#fff" : "rgba(255,255,255,0.45)" }} />
            ))}
          </div>
        </div>
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
              <div key={i} style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)" }}>
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
      <div style={{ width: 62, height: 4, background: "#3a3a3c", borderRadius: 99, margin: "9px auto 0" }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 4 — Banners
// ═══════════════════════════════════════════════════════════════════════════════

function BannersSection() {
  const { t } = useTranslations();
  const fileRef = useRef<HTMLInputElement>(null);

  const [banners, setBanners]     = useState<DbBanner[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState<BannerForm>(EMPTY_BANNER);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [cropSrc, setCropSrc]     = useState<string | null>(null);
  const [rawMimeType, setRawMimeType] = useState("image/jpeg");

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("banners").select("*").eq("restaurant_id", RESTAURANT_ID).order("order_index");
    if (data) setBanners(data as DbBanner[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditingId(null); setForm(EMPTY_BANNER); setModalOpen(true); }

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

  function closeModal() { setModalOpen(false); setEditingId(null); setForm(EMPTY_BANNER); }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setRawMimeType(f.type || "image/jpeg");
    setCropSrc(URL.createObjectURL(f));
    e.target.value = "";
  }

  function handleCropApply(blob: Blob, url: string) {
    const ext = rawMimeType === "image/png" ? "png" : rawMimeType === "image/webp" ? "webp" : "jpg";
    const croppedFile = new File([blob], `cropped.${ext}`, { type: blob.type });
    setForm(prev => ({ ...prev, imageFile: croppedFile, imagePreview: url }));
    setCropSrc(null);
  }

  async function handleSave() {
    if (!isConfigured) { toast.error("Database not configured"); return; }
    setSaving(true);
    try {
      let imageUrl: string | null = null;
      if (form.imageFile) imageUrl = await uploadImage(form.imageFile, "banners", "banner");
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
    if (error) { toast.error("Failed to delete banner"); }
    else { setBanners(prev => prev.filter(b => b.id !== id)); toast.success("Banner deleted"); }
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
    await Promise.all(reindexed.map(b => supabase.from("banners").update({ order_index: b.order_index }).eq("id", b.id)));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t.admin.descBanners}</p>
        <Button onClick={openCreate} size="sm">
          <Plus />
          {t.admin.addBanner}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground text-sm">
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
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <div className="w-20 h-12 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                  {b.image_url
                    ? <img src={b.image_url} alt="" className="w-full h-full object-cover" />
                    : <ImageIcon size={16} className="text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.title?.ru || b.title?.en || "—"}</p>
                  {b.link_url && <p className="text-xs text-muted-foreground truncate">{b.link_url}</p>}
                </div>
                <Badge className={`shrink-0 border-0 ${b.is_active
                  ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"}`}>
                  {b.is_active ? t.admin.on : t.admin.off}
                </Badge>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon-xs" onClick={() => move(b.id, "up")} disabled={idx === 0}>
                    <ChevronUp size={14} className="text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => move(b.id, "down")} disabled={idx === banners.length - 1}>
                    <ChevronDown size={14} className="text-muted-foreground" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(b)}>
                  <Pencil size={14} className="text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost" size="icon-sm"
                  onClick={() => handleDelete(b.id)}
                  disabled={deleting === b.id}
                  className="hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  {deleting === b.id
                    ? <Loader2 size={14} className="animate-spin text-muted-foreground" />
                    : <Trash2 size={14} className="text-red-500 dark:text-red-400" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t.admin.editBanner : t.admin.addBanner}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-6 min-h-0">
            <div className="flex-1 space-y-4 overflow-y-auto max-h-[60vh] pr-1 min-w-0">
              <div className="space-y-2">
                <Label>{t.admin.photoLabel}</Label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-36 rounded-xl border-2 border-dashed border-border hover:border-violet-500 cursor-pointer transition-colors bg-muted/50 flex items-center justify-center overflow-hidden"
                >
                  {form.imagePreview
                    ? <img src={form.imagePreview} alt="" className="w-full h-full object-cover" />
                    : <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon size={24} />
                        <span className="text-xs">{t.admin.uploadPhoto}</span>
                      </div>}
                </div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFileChange} />
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
            <div className="w-52 shrink-0 flex flex-col items-center gap-3 pt-1">
              <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest self-start">Preview</p>
              <BannerPhoneMockup title={form.title} imagePreview={form.imagePreview} />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">Так выглядит баннер в меню гостя</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>{t.admin.cancel}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? t.admin.saving : t.admin.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          aspect={2}
          mimeType={rawMimeType}
          onApply={handleCropApply}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}

// ── Banner phone mockup ───────────────────────────────────────────────────────

function BannerPhoneMockup({ title, imagePreview }: { title: string; imagePreview: string | null }) {
  return (
    <div style={{
      width: 196, background: "#1C1C1E", borderRadius: 36,
      padding: "18px 9px 14px",
      boxShadow: "inset 0 0 0 1.5px #3a3a3c, 0 12px 32px rgba(0,0,0,0.4)",
      flexShrink: 0,
    }}>
      <div style={{ width: 52, height: 7, background: "#2c2c2e", borderRadius: 99, margin: "0 auto 10px" }} />
      <div style={{ background: "#F5F5F7", borderRadius: 20, overflow: "hidden", padding: "10px 8px" }}>
        <div style={{ height: 6, width: "60%", background: "#e0e0e0", borderRadius: 4, marginBottom: 8 }} />
        <div style={{
          width: "100%", aspectRatio: "2 / 1", borderRadius: 12, overflow: "hidden",
          position: "relative", background: "#e5e5e5", border: "1px solid rgba(0,0,0,0.10)",
        } as React.CSSProperties}>
          {imagePreview
            ? <img src={imagePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🖼️</div>}
          {title && (
            <div style={{ position: "absolute", bottom: 5, left: 5, right: 5, background: "rgba(0,0,0,0.52)", borderRadius: 8, padding: "3px 7px" }}>
              <p style={{ color: "#fff", fontWeight: 700, fontSize: 9, margin: 0, lineHeight: 1.3, fontFamily: "'Montserrat', system-ui, sans-serif" }}>{title}</p>
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 6 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: i === 0 ? 12 : 4, height: 4, borderRadius: 99, background: i === 0 ? "#8B5CF6" : "#d0d0d0" }} />
          ))}
        </div>
      </div>
      <div style={{ width: 62, height: 4, background: "#3a3a3c", borderRadius: 99, margin: "9px auto 0" }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 5 — Recommendations ("А вы это пробовали?")
// ═══════════════════════════════════════════════════════════════════════════════

function RecommendationsSection() {
  const { t } = useTranslations();
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch]     = useState("");

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("restaurant_id", RESTAURANT_ID)
      .eq("is_archived", false)
      .order("name->ru");
    if (data) setProducts(data as DbProduct[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleRecommended(p: DbProduct) {
    if (!isConfigured) return;
    const next = !p.is_recommended;
    setToggling(p.id);
    const { error } = await supabase.from("products").update({ is_recommended: next }).eq("id", p.id);
    if (error) {
      toast.error("Failed to update");
    } else {
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_recommended: next } : x));
    }
    setToggling(null);
  }

  const recommendedCount = products.filter(p => p.is_recommended).length;

  const filtered = search
    ? products.filter(p => {
        const name = p.name?.ru ?? p.name?.en ?? "";
        return name.toLowerCase().includes(search.toLowerCase());
      })
    : products;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-4 border-b border-border shrink-0 flex items-center gap-4">
        <p className="text-xs text-muted-foreground flex-1">{t.admin.descRecommendations}</p>
        <span className="text-xs font-semibold text-violet-600 shrink-0">
          {recommendedCount} / 8 выбрано
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск блюд…"
              className="pl-8"
            />
          </div>

          {filtered.length === 0 && (
            <p className="text-center py-12 text-sm text-muted-foreground">Нет блюд</p>
          )}

          <div className="space-y-2">
            {filtered.map(p => {
              const name = p.name?.ru ?? p.name?.en ?? "—";
              const isRec = p.is_recommended;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    isRec
                      ? "border-violet-300 dark:border-violet-600/50 bg-violet-50/50 dark:bg-violet-500/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-lg">{p.emoji || "🍽"}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">{p.price.toLocaleString("ru-RU")} ₸</p>
                  </div>
                  {isRec && (
                    <Badge className="shrink-0 border-0 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300">
                      В рекомендациях
                    </Badge>
                  )}
                  <button
                    onClick={() => toggleRecommended(p)}
                    disabled={toggling === p.id || (!isRec && recommendedCount >= 8)}
                    title={!isRec && recommendedCount >= 8 ? "Максимум 8 блюд" : undefined}
                    className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      isRec
                        ? "bg-violet-600 text-white hover:bg-violet-700"
                        : "bg-muted text-muted-foreground hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-500/20 dark:hover:text-violet-300"
                    }`}
                  >
                    {toggling === p.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Star size={12} className={isRec ? "fill-white" : ""} />}
                    {isRec ? "Убрать" : "Рекомендовать"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 3 — Info Showcase
// ═══════════════════════════════════════════════════════════════════════════════

function InfoShowcaseSection() {
  const { t } = useTranslations();

  const [cards, setCards]         = useState<DbInfoShowcase[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState<ShowcaseForm>(EMPTY_SHOWCASE);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("info_showcases").select("*").eq("restaurant_id", RESTAURANT_ID).order("order_index");
    if (data) setCards(data as DbInfoShowcase[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditingId(null); setForm(EMPTY_SHOWCASE); setModalOpen(true); }

  function openEdit(c: DbInfoShowcase) {
    setEditingId(c.id);
    setForm({ title: c.title?.ru ?? c.title?.en ?? "", emoji: c.emoji, is_active: c.is_active });
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditingId(null); setForm(EMPTY_SHOWCASE); }

  async function handleSave() {
    if (!isConfigured) { toast.error("Database not configured"); return; }
    setSaving(true);
    try {
      const payload = {
        restaurant_id: RESTAURANT_ID,
        title: { en: form.title, ru: form.title, kz: form.title },
        emoji: form.emoji || "✨",
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
    if (error) { toast.error("Failed to delete card"); }
    else { setCards(prev => prev.filter(c => c.id !== id)); toast.success("Card deleted"); }
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
      <div className="px-8 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t.admin.descInfoShowcase}</p>
        <Button onClick={openCreate} size="sm">
          <Plus />
          {t.admin.addShowcaseCard}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground text-sm">
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
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
              >
                <div className="w-10 h-10 rounded-lg bg-muted shrink-0 flex items-center justify-center text-xl">
                  {c.emoji || "✨"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {c.title?.ru || c.title?.en || "—"}
                  </p>
                </div>
                <button onClick={() => toggleActive(c)} className="shrink-0">
                  <Badge className={`border-0 ${c.is_active
                    ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"}`}>
                    {c.is_active ? t.admin.on : t.admin.off}
                  </Badge>
                </button>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon-xs" onClick={() => move(c.id, "up")} disabled={idx === 0}>
                    <ChevronUp size={14} className="text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => move(c.id, "down")} disabled={idx === cards.length - 1}>
                    <ChevronDown size={14} className="text-muted-foreground" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)}>
                  <Pencil size={14} className="text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost" size="icon-sm"
                  onClick={() => handleDelete(c.id)}
                  disabled={deleting === c.id}
                  className="hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  {deleting === c.id
                    ? <Loader2 size={14} className="animate-spin text-muted-foreground" />
                    : <Trash2 size={14} className="text-red-500 dark:text-red-400" />}
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
          <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1">
            <div className="space-y-1.5">
              <Label>{t.admin.showcaseCardEmojiLabel}</Label>
              <Input
                value={form.emoji}
                onChange={e => setForm(prev => ({ ...prev, emoji: e.target.value }))}
                placeholder="✨"
                className="text-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.showcaseCardTitleLabel}</Label>
              <Input
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Доставка"
              />
            </div>
            <div className="flex items-center justify-between py-1">
              <Label>{t.admin.showcaseCardActive}</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>{t.admin.cancel}</Button>
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
