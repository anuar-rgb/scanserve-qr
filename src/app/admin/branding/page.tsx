"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbRestaurant } from "@/lib/db-types";
import { useTranslations } from "@/lib/i18n";
import { uploadImage } from "@/services/storage";
import { RESTAURANT_ID } from "@/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageCropModal } from "@/components/admin/ImageCropModal";

export default function BrandingPage() {
  const { t } = useTranslations();
  const logoRef  = useRef<HTMLInputElement>(null);

  const [restaurant, setRestaurant] = useState<DbRestaurant | null>(null);
  const [loading, setLoading]       = useState(true);
  const [name, setName]             = useState("");
  const [waNumber, setWaNumber]     = useState("");

  const [logoFile, setLogoFile]       = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);

  // Crop state
  const [cropSrc, setCropSrc]       = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<"logo" | null>(null);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    const { data } = await supabase
      .from("restaurants")
      .select("id, name, logo, cover_url, wa_number")
      .eq("id", RESTAURANT_ID)
      .single();
    if (data) {
      const r = data as DbRestaurant;
      setRestaurant(r);
      setName(r.name ?? "");
      setWaNumber(r.wa_number ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCropTarget("logo");
    setCropSrc(URL.createObjectURL(f));
    e.target.value = "";
  }

  function handleCropApply(blob: Blob, url: string) {
    const file = new File([blob], `branding-logo-${Date.now()}.jpg`, { type: blob.type });
    setLogoFile(file);
    setLogoPreview(url);
    setCropSrc(null);
    setCropTarget(null);
  }

  async function handleSave() {
    if (!isConfigured) { toast.error("Database not configured"); return; }
    setSaving(true);
    try {
      const updateData: { name: string; wa_number: string | null; logo?: string | null } = {
        name: name.trim(),
        wa_number: waNumber.trim() || null,
      };

      if (logoFile) {
        updateData.logo = await uploadImage(logoFile, "branding", "logo");
        setLogoPreview(updateData.logo ?? null);
        setLogoFile(null);
      }

      const { data, error: dbErr } = await supabase
        .from("restaurants")
        .update(updateData)
        .eq("id", RESTAURANT_ID)
        .select("id");

      if (dbErr) {
        throw new Error(`${dbErr.code}: ${dbErr.message} — ${dbErr.details ?? dbErr.hint ?? ""}`);
      }
      if (!data || data.length === 0) {
        throw new Error("Запись не найдена или нет прав на изменение");
      }

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
        <Loader2 size={16} className="animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-8 py-5 border-b border-border shrink-0 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{t.admin.navBranding}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t.admin.descBranding}</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="animate-spin" /> : <Upload />}
          {saving ? t.admin.saving : t.admin.save}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="flex gap-8 items-start" style={{ maxWidth: 920 }}>
          {/* Left: form cards */}
          <div className="flex-1 space-y-6 min-w-0">
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
          <div className="w-52 shrink-0 flex flex-col items-center gap-3 pt-0">
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest self-start">
              Preview
            </p>
            <BrandingPhoneMockup
              name={name}
              logoPreview={logoPreview ?? restaurant?.logo ?? null}
            />
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">
              Так выглядит шапка в меню гостя
            </p>
          </div>
        </div>
      </div>

      {/* Crop modal */}
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          aspect={1}
          mimeType="image/jpeg"
          onApply={handleCropApply}
          onCancel={() => { setCropSrc(null); setCropTarget(null); }}
        />
      )}
    </div>
  );
}

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
  name, logoPreview,
}: {
  name: string; logoPreview: string | null;
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
      {/* Pill notch */}
      <div style={{ width: 52, height: 7, background: "#2c2c2e", borderRadius: 99, margin: "0 auto 10px" }} />
      {/* Screen */}
      <div style={{ background: "#F5F5F7", borderRadius: 20, overflow: "hidden" }}>
        {/* Hero slider area (placeholder) */}
        <div style={{ position: "relative", height: 100, overflow: "hidden", background: "linear-gradient(135deg, #3b1f6e 0%, #1a1a2e 60%, #16213e 100%)" }}>
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <div style={{ fontSize: 20, opacity: 0.6 }}>▶</div>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.45)", fontFamily: "system-ui", letterSpacing: 1 }}>СЛАЙДЕР</div>
          </div>

          {/* Floating glass header */}
          <div style={{
            position: "absolute", top: 6, left: 5, right: 5,
            background: "rgba(11,11,17,0.72)",
            backdropFilter: "blur(14px)",
            borderRadius: 8,
            padding: "5px 8px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {/* Logo */}
            <div style={{
              width: 22, height: 22, borderRadius: 7, overflow: "hidden",
              background: "#3a3a3c", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {logoPreview ? (
                <img src={logoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 11, lineHeight: 1 }}>🍽</span>
              )}
            </div>
            {/* Name */}
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

        {/* Content below */}
        <div style={{ padding: "8px 8px 10px" }}>
          {/* Category pills */}
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
          {/* Dish cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {[0, 1, 2, 3].map(i => (
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
