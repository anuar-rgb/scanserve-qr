"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Lang } from "./MenuTemplate";

const CITY_COORDS: Record<string, [number, number]> = {
  abai:          [72.856, 49.636],
  aksai:         [53.003, 51.173],
  aksu:          [82.455, 52.037],
  aktau:         [51.166, 43.650],
  aktobe:        [57.207, 50.278],
  almaty:        [76.889, 43.238],
  altay:         [84.975, 49.960],
  aral:          [61.667, 46.800],
  arkalyk:       [66.908, 50.248],
  astana:        [71.430, 51.181],
  atbasar:       [68.359, 51.823],
  atyrau:        [51.904, 47.113],
  baikonur:      [63.306, 45.630],
  balkhash:      [74.985, 46.849],
  ekibastuz:     [75.318, 51.726],
  karagandy:     [73.086, 49.806],
  kokshetau:     [69.395, 53.285],
  kostanay:      [63.626, 53.215],
  kyzylorda:     [65.502, 44.852],
  oral:          [51.228, 51.235],
  oskemen:       [82.628, 49.948],
  pavlodar:      [76.940, 52.285],
  petropavl:     [69.134, 54.866],
  qonayev:       [78.025, 43.870],
  semey:         [80.228, 50.411],
  shymkent:      [69.598, 42.317],
  taldykorgan:   [78.374, 45.015],
  taraz:         [71.366, 42.900],
  temirtau:      [72.963, 50.058],
  turkestan:     [68.193, 43.300],
  zhezkazgan:    [67.714, 47.796],
};

const DEFAULT_CENTER: [number, number] = [76.889, 43.238]; // Almaty

const KZ_CITIES: { id: string; ru: string; en: string; kz: string }[] = [
  { id: "abai", ru: "Абай", en: "Abai", kz: "Абай" },
  { id: "aksai", ru: "Аксай", en: "Aksai", kz: "Ақсай" },
  { id: "aksu", ru: "Аксу", en: "Aksu", kz: "Ақсу" },
  { id: "aktau", ru: "Актау", en: "Aktau", kz: "Ақтау" },
  { id: "aktobe", ru: "Актобе", en: "Aktobe", kz: "Ақтөбе" },
  { id: "almaty", ru: "Алматы", en: "Almaty", kz: "Алматы" },
  { id: "altay", ru: "Алтай", en: "Altay", kz: "Алтай" },
  { id: "aral", ru: "Арал", en: "Aral", kz: "Арал" },
  { id: "arkalyk", ru: "Аркалык", en: "Arkalyk", kz: "Арқалық" },
  { id: "astana", ru: "Астана", en: "Astana", kz: "Астана" },
  { id: "atbasar", ru: "Атбасар", en: "Atbasar", kz: "Атбасар" },
  { id: "atyrau", ru: "Атырау", en: "Atyrau", kz: "Атырау" },
  { id: "baikonur", ru: "Байконур", en: "Baikonur", kz: "Байқоңыр" },
  { id: "balkhash", ru: "Балхаш", en: "Balkhash", kz: "Балқаш" },
  { id: "ekibastuz", ru: "Экибастуз", en: "Ekibastuz", kz: "Екібастұз" },
  { id: "karagandy", ru: "Қарағанды", en: "Karagandy", kz: "Қарағанды" },
  { id: "kokshetau", ru: "Кокшетау", en: "Kokshetau", kz: "Көкшетау" },
  { id: "kostanay", ru: "Костанай", en: "Kostanay", kz: "Қостанай" },
  { id: "kyzylorda", ru: "Кызылорда", en: "Kyzylorda", kz: "Қызылорда" },
  { id: "oral", ru: "Орал", en: "Oral", kz: "Орал" },
  { id: "oskemen", ru: "Өскемен", en: "Oskemen", kz: "Өскемен" },
  { id: "pavlodar", ru: "Павлодар", en: "Pavlodar", kz: "Павлодар" },
  { id: "petropavl", ru: "Петропавл", en: "Petropavl", kz: "Петропавл" },
  { id: "qonayev", ru: "Конаев", en: "Qonayev", kz: "Қонаев" },
  { id: "semey", ru: "Семей", en: "Semey", kz: "Семей" },
  { id: "shymkent", ru: "Шымкент", en: "Shymkent", kz: "Шымкент" },
  { id: "taldykorgan", ru: "Талдыкорган", en: "Taldykorgan", kz: "Талдықорған" },
  { id: "taraz", ru: "Тараз", en: "Taraz", kz: "Тараз" },
  { id: "temirtau", ru: "Темиртау", en: "Temirtau", kz: "Теміртау" },
  { id: "turkestan", ru: "Туркестан", en: "Turkestan", kz: "Түркістан" },
  { id: "zhezkazgan", ru: "Жезказган", en: "Zhezkazgan", kz: "Жезқазған" },
];

function matchCity(cityName: string): string {
  if (!cityName) return "";
  const lower = cityName.toLowerCase().trim();
  for (const c of KZ_CITIES) {
    if (
      c.ru.toLowerCase().includes(lower) ||
      lower.includes(c.ru.toLowerCase()) ||
      c.en.toLowerCase().includes(lower) ||
      lower.includes(c.en.toLowerCase()) ||
      c.kz.toLowerCase().includes(lower) ||
      lower.includes(c.kz.toLowerCase())
    ) return c.id;
  }
  return "";
}

interface MapPickerModalProps {
  lang: Lang;
  cityId?: string;
  onConfirm: (result: { cityId: string; address: string; cityName: string }) => void;
  onClose: () => void;
}

const UI = {
  ru: {
    title: "Выберите точку доставки",
    hint: "Нажмите на карте, чтобы выбрать адрес",
    geocoding: "Определяем адрес...",
    noAddr: "Адрес не найден. Попробуйте другое место.",
    confirm: "Подтвердить адрес",
    noKey: "API ключ 2GIS не настроен. Добавьте NEXT_PUBLIC_2GIS_API_KEY.",
  },
  en: {
    title: "Select delivery point",
    hint: "Tap on the map to select an address",
    geocoding: "Looking up address...",
    noAddr: "Address not found. Try another location.",
    confirm: "Confirm address",
    noKey: "2GIS API key not configured. Add NEXT_PUBLIC_2GIS_API_KEY.",
  },
  kz: {
    title: "Жеткізу нүктесін таңдаңыз",
    hint: "Мекенжайды таңдау үшін картаға басыңыз",
    geocoding: "Мекенжай анықталуда...",
    noAddr: "Мекенжай табылмады. Басқа жерді таңдаңыз.",
    confirm: "Мекенжайды растау",
    noKey: "2GIS API кілті конфигурацияланбаған.",
  },
};

export function MapPickerModal({ lang, cityId, onConfirm, onClose }: MapPickerModalProps) {
  const t = UI[lang] ?? UI.ru;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);
  const [status, setStatus] = useState<"hint" | "geocoding" | "found" | "error" | "nokey">("hint");
  const [foundAddress, setFoundAddress] = useState("");
  const [foundCityId, setFoundCityId] = useState("");
  const [foundCityName, setFoundCityName] = useState("");
  const [tipDismissed, setTipDismissed] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_2GIS_API_KEY ?? "";

  const handleMapClick = useCallback(async (lng: number, lat: number) => {
    setStatus("geocoding");
    setFoundAddress("");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapglModule = (await import("@2gis/mapgl")) as any;
      const mapgl = await mapglModule.load();

      // Update or create marker
      if (markerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (markerRef.current as any).setCoordinates([lng, lat]);
      } else {
        markerRef.current = new mapgl.Marker(mapRef.current, {
          coordinates: [lng, lat],
        });
      }

      // Reverse geocode via 2GIS Catalog API
      const url = `https://catalog.api.2gis.com/3.0/items/geocode?lat=${lat}&lon=${lng}&fields=items.address_name,items.context&key=${apiKey}&lang=ru`;
      const res = await fetch(url);
      const data = await res.json() as {
        result?: {
          items?: Array<{
            address_name?: string;
            context?: { city?: { name?: string }; region?: { name?: string } };
          }>;
        };
      };

      const item = data.result?.items?.[0];
      if (!item) { setStatus("error"); return; }

      const street = item.address_name ?? "";
      const cityName = item.context?.city?.name ?? item.context?.region?.name ?? "";
      const cityId = matchCity(cityName);

      setFoundAddress(street);
      setFoundCityId(cityId);
      setFoundCityName(cityName);
      setStatus("found");
    } catch {
      setStatus("error");
    }
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) { setStatus("nokey"); return; }
    if (!mapContainerRef.current) return;

    let map: unknown;
    let destroyed = false;

    import("@2gis/mapgl").then(async (mapgl) => {
      if (destroyed || !mapContainerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const M = mapgl as any;

      // load() must be called before creating Map to init WebGL renderer
      const mapglLoaded = await M.load();
      if (destroyed || !mapContainerRef.current) return;

      const fallbackCenter = (cityId && CITY_COORDS[cityId]) ? CITY_COORDS[cityId] : DEFAULT_CENTER;
      map = new mapglLoaded.Map(mapContainerRef.current, {
        center: fallbackCenter,
        zoom: 13,
        key: apiKey,
      });
      mapRef.current = map;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).on("click", (e: { lngLat: [number, number] }) => {
        const [lng, lat] = e.lngLat;
        handleMapClick(lng, lat);
      });

      // Request geolocation after map is ready
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (destroyed) return;
            const { longitude, latitude } = pos.coords;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (mapRef.current as any)?.setCenter([longitude, latitude]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (mapRef.current as any)?.setZoom(16);
            handleMapClick(longitude, latitude);
          },
          () => { /* denied — stay on city center */ },
          { timeout: 8000, maximumAge: 60000 },
        );
      }
    }).catch(() => setStatus("error"));

    return () => {
      destroyed = true;
      if (map) {
        try { (map as { destroy?: () => void }).destroy?.(); } catch { /* ignore */ }
      }
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [apiKey, handleMapClick]);

  const handleConfirm = () => {
    if (!foundAddress) return;
    onConfirm({ cityId: foundCityId, address: foundAddress, cityName: foundCityName });
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "relative", zIndex: 1,
          background: "var(--bg-color, #fff)",
          borderRadius: "20px 20px 0 0",
          height: "72dvh",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--border-color, rgba(0,0,0,0.1))",
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-color, #111)" }}>
            {t.title}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 99, border: "none",
              background: "var(--bg-secondary, rgba(0,0,0,0.06))",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 16, color: "var(--text-color, #111)",
            }}
          >✕</button>
        </div>

        {/* Map area */}
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          {status === "nokey" ? (
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              alignItems: "center", justifyContent: "center",
              padding: 24, textAlign: "center",
              fontSize: 13, color: "var(--text-muted, #888)",
            }}>
              {t.noKey}
            </div>
          ) : (
            <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
          )}
        </div>

        {/* Tip banner */}
        {status === "found" && !tipDismissed && (
          <div style={{
            margin: "8px 12px 0",
            padding: "9px 12px",
            borderRadius: 12,
            background: "rgba(139,92,246,0.1)",
            border: "1px solid rgba(139,92,246,0.25)",
            display: "flex", alignItems: "flex-start", gap: 8,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>💡</span>
            <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-color, #333)", flex: 1 }}>
              {lang === "kz"
                ? "Мекенжай дұрыс анықталмаса — картада дұрыс нүктені басыңыз."
                : lang === "en"
                ? "If the address is wrong — tap the correct spot on the map."
                : "Если адрес определился неверно — нажмите на нужную точку на карте."}
            </span>
            <button
              onClick={() => setTipDismissed(true)}
              style={{
                flexShrink: 0, background: "none", border: "none",
                cursor: "pointer", padding: 2, lineHeight: 1,
                color: "rgba(139,92,246,0.7)", fontSize: 16, fontWeight: 700,
              }}
            >✕</button>
          </div>
        )}

        {/* Bottom result strip */}
        <div style={{
          flexShrink: 0,
          borderTop: "1px solid var(--border-color, rgba(0,0,0,0.1))",
          padding: "12px 16px 20px",
          background: "var(--bg-color, #fff)",
        }}>
          {/* Status / found address */}
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12,
            minHeight: 36,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>
              {status === "found" ? "📍" : status === "geocoding" ? "⏳" : status === "error" ? "⚠️" : "🗺️"}
            </span>
            <span style={{
              fontSize: 13, lineHeight: 1.4,
              color: status === "error" ? "#e53935" : "var(--text-color, #111)",
            }}>
              {status === "hint" && t.hint}
              {status === "geocoding" && t.geocoding}
              {status === "found" && foundAddress}
              {status === "error" && t.noAddr}
              {status === "nokey" && ""}
            </span>
          </div>

          {/* Confirm button */}
          <button
            disabled={status !== "found"}
            onClick={handleConfirm}
            style={{
              width: "100%", padding: "13px 0",
              borderRadius: 14, border: "none",
              background: status === "found" ? "#8B5CF6" : "rgba(0,0,0,0.1)",
              color: status === "found" ? "#fff" : "rgba(0,0,0,0.35)",
              fontWeight: 700, fontSize: 15,
              cursor: status === "found" ? "pointer" : "not-allowed",
              transition: "background 0.2s ease",
            }}
          >
            {t.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
