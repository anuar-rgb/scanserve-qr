"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, AlertCircle } from "lucide-react";

interface Props {
  title?: string;
  hint?: string;
  onScan: (token: string) => void;
  onClose?: () => void;
}

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID!;

export default function QrScannerModal({ title, hint, onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handledRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    startCamera();
    return stopCamera;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
          startScanInterval();
        };
      }
    } catch {
      setError("Не удалось открыть камеру. Разрешите доступ к камере в настройках браузера.");
    }
  }

  function stopCamera() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function startScanInterval() {
    intervalRef.current = setInterval(scanFrame, 250);
  }

  function scanFrame() {
    if (handledRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    import("jsqr").then(({ default: jsQR }) => {
      if (handledRef.current) return;
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (!code) return;
      handleQrData(code.data);
    });
  }

  function handleQrData(raw: string) {
    if (handledRef.current) return;
    try {
      const parsed = JSON.parse(raw) as { r?: string; t?: string; v?: string };
      if (parsed.v !== "checkin" || parsed.r !== RESTAURANT_ID || !parsed.t) {
        setError("Неверный QR-код заведения");
        return;
      }
      handledRef.current = true;
      stopCamera();
      onScan(parsed.t);
    } catch {
      setError("Неверный QR-код заведения");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 pt-safe shrink-0 bg-black/70">
        <h2 className="text-white font-semibold text-base">
          {title ?? "Сканирование QR"}
        </h2>
        {onClose && (
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Camera */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan frame overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Dimmed corners */}
          <div className="absolute inset-0 bg-black/40" style={{ clipPath: "polygon(0% 0%, 0% 100%, 25% 100%, 25% 25%, 75% 25%, 75% 75%, 25% 75%, 25% 100%, 100% 100%, 100% 0%)" }} />

          {/* Frame */}
          <div className="relative w-56 h-56">
            {/* Corners */}
            <span className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-white rounded-tl-lg" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-white rounded-tr-lg" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-white rounded-bl-lg" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-white rounded-br-lg" />

            {/* Scan line animation */}
            {cameraReady && !error && (
              <div className="absolute left-2 right-2 h-0.5 bg-violet-400/80 animate-[scanline_2s_ease-in-out_infinite]" />
            )}
          </div>
        </div>

        {/* Error toast */}
        {error && (
          <div className="absolute bottom-6 left-4 right-4 bg-red-500/95 text-white rounded-2xl px-4 py-3 flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{error}</p>
              <button
                className="mt-1 text-xs text-white/70 underline"
                onClick={() => setError(null)}
              >
                Попробовать снова
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      <div className="shrink-0 px-6 py-5 bg-black/70 text-center space-y-1">
        <Camera size={20} className="text-white/30 mx-auto" />
        <p className="text-white/50 text-sm">
          {hint ?? "Наведите камеру на QR-код у входа в заведение"}
        </p>
      </div>

      <style>{`
        @keyframes scanline {
          0%   { top: 8px; opacity: 1; }
          50%  { top: calc(100% - 8px); opacity: 0.6; }
          100% { top: 8px; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
