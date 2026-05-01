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

export default function BrandingPage() {
  const { t } = useTranslations();
  const logoRef  = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const [restaurant, setRestaurant] = useState<DbRestaurant | null>(null);
  const [loading, setLoading]       = useState(true);
  const [name, setName]             = useState("");
  const [waNumber, setWaNumber]     = useState("");

  const [logoFile, setLogoFile]         = useState<File | null>(null);
  const [logoPreview, setLogoPreview]   = useState<string | null>(null);
  const [coverFile, setCoverFile]       = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);

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
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  }

  function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  }

  async function handleSave() {
    if (!isConfigured) { toast.error("Database not configured"); return; }
    setSaving(true);
    try {
      const payload: Partial<DbRestaurant> & { id: string } = {
        id: RESTAURANT_ID,
        name: name.trim(),
        wa_number: waNumber.trim() || null,
      };

      if (logoFile) {
        payload.logo = await uploadImage(logoFile, "branding", "logo");
        setLogoPreview(payload.logo ?? null);
        setLogoFile(null);
      }
      if (coverFile) {
        payload.cover_url = await uploadImage(coverFile, "branding", "cover");
        setCoverPreview(payload.cover_url ?? null);
        setCoverFile(null);
      }

      const { error: dbErr } = await supabase
        .from("restaurants")
        .upsert(payload);
      if (dbErr) throw dbErr;

      setRestaurant((prev) =>
        prev
          ? { ...prev, ...payload }
          : ({ slug: null, logo: null, cover_url: null, ...payload } as DbRestaurant),
      );

      toast.success(t.admin.brandingSaved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed. Check Supabase policies.");
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

      <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-2xl">
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
          <CardContent className="space-y-6 pt-5">
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
            <div className="border-t border-border" />
            <UploadField
              label={t.admin.coverLabel}
              description={t.admin.coverDesc}
              aspect="wide"
              currentUrl={coverPreview ?? restaurant?.cover_url ?? null}
              fileRef={coverRef}
              onChange={onCoverChange}
              uploadLabel={t.admin.uploadPhoto}
              changeLabel={t.admin.changePhoto}
            />
          </CardContent>
        </Card>
      </div>
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
