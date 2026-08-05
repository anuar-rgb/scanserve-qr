"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Loader2, ImageIcon, Copy, ExternalLink, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase, isConfigured } from "@/lib/supabase";
import type { DbRestaurant } from "@/lib/db-types";
import { useTranslations } from "@/lib/i18n";
import { useIsStrictOwner } from "@/lib/role-context";
import { uploadImage } from "@/services/storage";
import { RESTAURANT_ID } from "@/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageCropModal } from "@/components/admin/ImageCropModal";

export default function SettingsPage() {
  const { t } = useTranslations();
  const isStrictOwner = useIsStrictOwner();
  const logoRef = useRef<HTMLInputElement>(null);

  const [restaurant, setRestaurant] = useState<DbRestaurant | null>(null);
  const [loading, setLoading]       = useState(true);
  const [name, setName]             = useState("");
  const [waNumber, setWaNumber]     = useState("");
  const [reportWhatsapp, setReportWhatsapp] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [phone, setPhone]           = useState("");
  const [address, setAddress]       = useState("");
  const [workingHours, setWorkingHours] = useState("");

  const [logoFile, setLogoFile]     = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);

  const [cropSrc, setCropSrc]       = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting]   = useState(false);

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    const { data } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", RESTAURANT_ID)
      .single();
    if (data) {
      const r = data as DbRestaurant;
      setRestaurant(r);
      setName(r.name ?? "");
      setWaNumber(r.wa_number ?? "");
      setReportWhatsapp(r.report_whatsapp ?? "");
      setInstagramUrl(r.instagram_url ?? "");
      setPhone(r.phone ?? "");
      setAddress(r.address ?? "");
      setWorkingHours(r.working_hours ?? "");
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
    const file = new File([blob], `branding-logo-${Date.now()}.png`, { type: blob.type });
    setLogoFile(file);
    setLogoPreview(url);
    setCropSrc(null);
  }

  async function handleSave() {
    if (!isConfigured) { toast.error("Database not configured"); return; }
    setSaving(true);
    try {
      const updateData: {
        name: string;
        wa_number: string | null;
        report_whatsapp: string | null;
        instagram_url: string | null;
        phone: string | null;
        address: string | null;
        working_hours: string | null;
        logo?: string | null;
      } = {
        name: name.trim(),
        wa_number: waNumber.trim() || null,
        report_whatsapp: reportWhatsapp.replace(/\D/g, "") || null,
        instagram_url: instagramUrl.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        working_hours: workingHours.trim() || null,
      };

      if (logoFile) {
        updateData.logo = await uploadImage(logoFile, "branding", "logo");
        setLogoPreview(updateData.logo ?? null);
        setLogoFile(null);
      }

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Ошибка сохранения");
      }

      setRestaurant((prev) => prev ? { ...prev, ...updateData } : null);
      toast.success(t.admin.brandingSaved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestReset() {
    setResetting(true);
    try {
      const res = await fetch("/api/admin/test-reset-all", { method: "POST" });
      if (res.ok) {
        toast.success("Тестовые данные сброшены — заказы, бонусы и чаевые удалены");
      } else {
        const json = await res.json() as { error?: string };
        toast.error(`Ошибка: ${json.error ?? "неизвестно"}`);
      }
    } catch {
      toast.error("Сетевая ошибка");
    }
    setResetting(false);
    setResetConfirm(false);
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
      <header className="px-4 md:px-8 py-4 md:py-5 border-b border-border shrink-0 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{t.admin.navProfile}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t.admin.descProfile}</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="animate-spin" /> : <Upload />}
          {saving ? t.admin.saving : t.admin.save}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start" style={{ maxWidth: 920 }}>
          {/* Left: form cards */}
          <div className="flex-1 space-y-6 min-w-0">

            {/* Logo */}
            <Card>
              <CardHeader>
                <CardTitle>{t.admin.imagesSection}</CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <UploadField
                  label={t.admin.logoLabel}
                  description={t.admin.logoDesc}
                  currentUrl={logoPreview ?? restaurant?.logo ?? null}
                  fileRef={logoRef}
                  onChange={onLogoChange}
                  uploadLabel={t.admin.uploadPhoto}
                  changeLabel={t.admin.changePhoto}
                />
              </CardContent>
            </Card>

            {/* Identity */}
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
                <div className="space-y-1.5">
                  <Label htmlFor="report-whatsapp">Номер WhatsApp для итоговых отчётов смены</Label>
                  <Input
                    id="report-whatsapp"
                    value={reportWhatsapp}
                    onChange={(e) => setReportWhatsapp(e.target.value)}
                    placeholder="77001234567"
                    inputMode="tel"
                  />
                  <p className="text-xs text-muted-foreground">
                    При закрытии смены отчёт автоматически откроется в WhatsApp на этот номер. Введите без пробелов и плюса, например: 77001234567
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Contacts & Hours */}
            <Card>
              <CardHeader>
                <CardTitle>Контакты и режим работы</CardTitle>
                <CardDescription>Отображаются в разделе «Связаться с нами» гостевого меню.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <div className="space-y-1.5">
                  <Label htmlFor="instagram-url">Instagram</Label>
                  <Input
                    id="instagram-url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    placeholder="https://www.instagram.com/yourplace"
                  />
                  <p className="text-xs text-muted-foreground">Полный URL профиля Instagram.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Номер телефона</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 700 000 0000"
                  />
                  <p className="text-xs text-muted-foreground">Кнопка «Позвонить» откроет этот номер.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Адрес</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="г. Алматы, ул. Примерная, 1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="working-hours">Часы работы</Label>
                  <Input
                    id="working-hours"
                    value={workingHours}
                    onChange={(e) => setWorkingHours(e.target.value)}
                    placeholder="10:00 – 22:00"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Guest Links */}
            {restaurant?.slug && (() => {
              const base = typeof window !== "undefined" ? window.location.origin : "https://scanserve-qr-production-2cff.up.railway.app";
              const menuUrl = `${base}/${restaurant.slug}`;
              const qrUrl = `${base}/${restaurant.slug}/qr`;
              function copyUrl(url: string) {
                navigator.clipboard.writeText(url);
                toast.success("Скопировано");
              }
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Ссылки для гостей</CardTitle>
                    <CardDescription>Скопируйте и поделитесь с гостями</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Гостевое меню</Label>
                      <div className="flex items-center gap-2">
                        <Input readOnly value={menuUrl} className="text-xs font-mono" />
                        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => copyUrl(menuUrl)}>
                          <Copy size={14} />
                        </Button>
                        <a href={menuUrl} target="_blank" rel="noopener noreferrer">
                          <Button type="button" variant="outline" size="icon" className="shrink-0">
                            <ExternalLink size={14} />
                          </Button>
                        </a>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>QR-страница для печати</Label>
                      <div className="flex items-center gap-2">
                        <Input readOnly value={qrUrl} className="text-xs font-mono" />
                        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => copyUrl(qrUrl)}>
                          <Copy size={14} />
                        </Button>
                        <a href={qrUrl} target="_blank" rel="noopener noreferrer">
                          <Button type="button" variant="outline" size="icon" className="shrink-0">
                            <ExternalLink size={14} />
                          </Button>
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
            {/* Test data reset — strict owner only */}
            {isStrictOwner && (
              <Card className="border-red-200 dark:border-red-900/40">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="text-red-500 shrink-0" />
                    <CardTitle className="text-red-600 dark:text-red-400">Сброс тестовых данных</CardTitle>
                  </div>
                  <CardDescription>
                    Удаляет все заказы, бонусные балансы и историю бонусов ресторана. Только для тестирования.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!resetConfirm ? (
                    <Button
                      variant="outline"
                      className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => setResetConfirm(true)}
                    >
                      <Trash2 size={14} />
                      Очистить все тестовые данные
                    </Button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                        Удалить все заказы и бонусы?
                      </span>
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                        disabled={resetting}
                        onClick={handleTestReset}
                      >
                        {resetting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        Да, сбросить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resetting}
                        onClick={() => setResetConfirm(false)}
                      >
                        Отмена
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

          </div>

          {/* Right: phone preview */}
          <div className="w-52 shrink-0 flex-col items-center gap-3 pt-0 hidden md:flex">
            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest self-start">
              Preview
            </p>
            <ProfilePhoneMockup
              name={name}
              logoPreview={logoPreview ?? restaurant?.logo ?? null}
            />
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">
              Так выглядит шапка в меню гостя
            </p>
          </div>
        </div>
      </div>

      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          aspect={1}
          mimeType="image/png"
          onApply={handleCropApply}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}

function UploadField({
  label, description, currentUrl, fileRef, onChange, uploadLabel, changeLabel,
}: {
  label: string;
  description: string;
  currentUrl: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadLabel: string;
  changeLabel: string;
}) {
  return (
    <div className="flex gap-5 items-start">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 border-dashed border-border hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer transition-colors flex items-center justify-center"
        style={{ background: currentUrl ? "transparent" : undefined }}
      >
        {currentUrl ? (
          <img src={currentUrl} alt={label} className="w-full h-full object-contain" />
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
        <p className="text-[11px] text-muted-foreground">PNG с прозрачным фоном — лучший вариант для логотипа. JPG, WebP — max 5 MB</p>
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

function ProfilePhoneMockup({
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
            borderRadius: 8,
            padding: "5px 8px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{
              width: 22, height: 22, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {logoPreview ? (
                <img src={logoPreview} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", mixBlendMode: "screen" } as React.CSSProperties} />
              ) : (
                <span style={{ fontSize: 11, lineHeight: 1 }}>🍽</span>
              )}
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
      <div style={{ width: 62, height: 4, background: "#3a3a3c", borderRadius: 99, margin: "9px auto 0" }} />
    </div>
  );
}
