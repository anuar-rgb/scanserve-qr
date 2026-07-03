"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Lang } from "./MenuTemplate";

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
  onConfirm: (result: { cityId: string; address: string }) => void;
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

export function MapPickerModal({ lang, onConfirm, onClose }: MapPickerModalProps) {
  const t = UI[lang] ?? UI.ru;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);
  const [status, setStatus] = useState<"hint" | "geocoding" | "found" | "error" | "nokey">("hint");
  const [foundAddress, setFoundAddress] = useState("");
  const [foundCityId, setFoundCityId] = useState("");
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

      map = new mapglLoaded.Map(mapContainerRef.current, {
        center: [76.889709, 43.238293],
        zoom: 12,
        key: apiKey,
      });
      mapRef.current = map;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).on("click", (e: { lngLat: [number, number] }) => {
        const [lng, lat] = e.lngLat;
        handleMapClick(lng, lat);
      });
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
    onConfirm({ cityId: foundCityId, address: foundAddress });
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
