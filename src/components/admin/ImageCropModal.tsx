"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { getCroppedImg } from "@/lib/cropImage";

interface ImageCropModalProps {
  src: string;
  aspect?: number;
  mimeType?: string;
  onApply: (blob: Blob, previewUrl: string) => void;
  onCancel: () => void;
}

export function ImageCropModal({
  src,
  aspect = 1,
  mimeType = "image/jpeg",
  onApply,
  onCancel,
}: ImageCropModalProps) {
  const [crop, setCrop]   = useState({ x: 0, y: 0 });
  const [zoom, setZoom]   = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleApply() {
    if (!croppedAreaPixels) return;
    setApplying(true);
    try {
      const blob = await getCroppedImg(src, croppedAreaPixels, mimeType);
      onApply(blob, URL.createObjectURL(blob));
    } catch (e) {
      console.error("Crop failed:", e);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col gap-4 p-6">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Обрезка фото
        </h3>

        {/* Crop area */}
        <div className="relative w-full rounded-xl overflow-hidden bg-zinc-900" style={{ height: 300 }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <ZoomOut size={14} className="text-zinc-400 shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-violet-600"
          />
          <ZoomIn size={14} className="text-zinc-400 shrink-0" />
          <span className="text-xs text-zinc-400 w-8 text-right tabular-nums">
            {zoom.toFixed(1)}×
          </span>
        </div>

        <p className="text-[11px] text-zinc-400 -mt-2 text-center">
          Перетащите или масштабируйте, чтобы выбрать область
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleApply}
            disabled={applying}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {applying && <Loader2 size={14} className="animate-spin" />}
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}
