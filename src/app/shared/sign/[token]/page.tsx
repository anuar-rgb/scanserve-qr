"use client";

import { useEffect, useRef, useState, use } from "react";
import { CheckCircle2, AlertCircle, Loader2, RotateCcw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignRequest {
  status:    "pending" | "signed";
  signedAt:  string | null;
  staffName: string;
  document: {
    title:   string;
    content: string;
  };
}

// ─── Inline design tokens ─────────────────────────────────────────────────────
const BG     = "#09090B";
const CARD   = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT   = "#F4F4F5";
const MUTED  = "#71717A";
const VIOLET = "#7C3AED";
const GREEN  = "#22C55E";
const RED    = "#EF4444";

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [data,          setData]          = useState<SignRequest | null>(null);
  const [loadError,     setLoadError]     = useState<string | null>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [hasSignature,  setHasSignature]  = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [done,          setDone]          = useState(false);

  const docScrollRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const isDrawing    = useRef(false);
  const lastPos      = useRef<{ x: number; y: number } | null>(null);

  // ── Load sign request ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/sign/${token}`)
      .then((r) => r.json())
      .then((d: SignRequest & { error?: string }) => {
        if (d.error) { setLoadError(d.error); return; }
        setData(d);
        if (d.status === "signed") setDone(true);
      })
      .catch(() => setLoadError("Не удалось загрузить документ"));
  }, [token]);

  // ── Canvas drawing (pointer events — works for mouse + touch) ─────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#1C1C1E";
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";

    function getXY(e: PointerEvent): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas!.width  / rect.width),
        y: (e.clientY - rect.top)  * (canvas!.height / rect.height),
      };
    }

    function onDown(e: PointerEvent) {
      e.preventDefault();
      canvas!.setPointerCapture(e.pointerId);
      isDrawing.current = true;
      const p = getXY(e);
      lastPos.current = p;
      ctx!.beginPath();
      ctx!.moveTo(p.x, p.y);
    }

    function onMove(e: PointerEvent) {
      e.preventDefault();
      if (!isDrawing.current) return;
      const p = getXY(e);
      ctx!.lineTo(p.x, p.y);
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.moveTo(p.x, p.y);
      lastPos.current = p;
      setHasSignature(true);
    }

    function onUp(e: PointerEvent) {
      e.preventDefault();
      isDrawing.current = false;
      lastPos.current   = null;
    }

    canvas.addEventListener("pointerdown",   onDown,  { passive: false });
    canvas.addEventListener("pointermove",   onMove,  { passive: false });
    canvas.addEventListener("pointerup",     onUp,    { passive: false });
    canvas.addEventListener("pointercancel", onUp,    { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown",   onDown);
      canvas.removeEventListener("pointermove",   onMove);
      canvas.removeEventListener("pointerup",     onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [data]); // re-attach after data loads (canvas becomes visible)

  // ── Scroll tracking ────────────────────────────────────────────────────────
  function handleDocScroll() {
    const el = docScrollRef.current;
    if (!el) return;
    if (Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight) {
      setScrolledToEnd(true);
    }
  }

  // ── Clear canvas ───────────────────────────────────────────────────────────
  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  // ── Submit signature ───────────────────────────────────────────────────────
  async function handleSubmit() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSubmitting(true);
    try {
      const signatureImage = canvas.toDataURL("image/png");
      const res = await fetch(`/api/sign/${token}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ signatureImage }),
      });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Ошибка подписания");
      setDone(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    minHeight:       "100dvh",
    background:      BG,
    color:           TEXT,
    fontFamily:      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display:         "flex",
    flexDirection:   "column",
    alignItems:      "center",
  };

  const innerStyle: React.CSSProperties = {
    width:    "100%",
    maxWidth: 480,
    padding:  "0 0 40px",
    display:  "flex",
    flexDirection: "column",
    gap:      0,
  };

  // Loading
  if (!data && !loadError) {
    return (
      <div style={{ ...containerStyle, justifyContent: "center", gap: 12 }}>
        <Loader2 size={28} style={{ color: VIOLET, animation: "spin 1s linear infinite" }} />
        <p style={{ color: MUTED, fontSize: 14 }}>Загружаем документ…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Error
  if (loadError) {
    return (
      <div style={{ ...containerStyle, justifyContent: "center", padding: "0 24px", textAlign: "center", gap: 12 }}>
        <AlertCircle size={40} style={{ color: RED }} />
        <p style={{ fontSize: 16, fontWeight: 600 }}>Ссылка недействительна</p>
        <p style={{ color: MUTED, fontSize: 14 }}>{loadError}</p>
      </div>
    );
  }

  // Already signed
  if (done) {
    return (
      <div style={{ ...containerStyle, justifyContent: "center", padding: "0 24px", textAlign: "center", gap: 12 }}>
        <CheckCircle2 size={56} style={{ color: GREEN }} />
        <p style={{ fontSize: 18, fontWeight: 700 }}>Документ подписан</p>
        <p style={{ color: MUTED, fontSize: 14 }}>
          «{data?.document.title}»
          {data?.status === "signed" && data.signedAt && (
            <><br />Подписан: {new Date(data.signedAt).toLocaleString("ru-RU")}</>
          )}
        </p>
        <p style={{ color: MUTED, fontSize: 13, marginTop: 8 }}>Вы можете закрыть эту страницу</p>
      </div>
    );
  }

  const canSign = scrolledToEnd && hasSignature;

  return (
    <div style={containerStyle}>
      <div style={innerStyle}>

        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Цифровое подписание
          </p>
          <h1 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>
            {data!.document.title}
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
            Для: <span style={{ color: TEXT }}>{data!.staffName}</span>
          </p>
        </div>

        {/* Instruction */}
        <div style={{ padding: "12px 20px", background: "rgba(124,58,237,0.08)", borderBottom: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 13, color: "#C4B5FD", margin: 0, lineHeight: 1.5 }}>
            📋 Прочитайте документ до конца, затем поставьте подпись пальцем в поле ниже.
          </p>
        </div>

        {/* Document content — scrollable, gated */}
        <div
          ref={docScrollRef}
          onScroll={handleDocScroll}
          style={{
            margin:     "16px 20px 0",
            maxHeight:  "38vh",
            overflowY:  "auto",
            background: CARD,
            borderRadius: 12,
            border:     `1px solid ${BORDER}`,
            padding:    "16px",
          }}
        >
          <pre style={{
            fontSize:      13,
            lineHeight:    1.7,
            color:         "#D4D4D8",
            whiteSpace:    "pre-wrap",
            wordBreak:     "break-word",
            fontFamily:    "inherit",
            margin:        0,
          }}>
            {data!.document.content}
          </pre>
        </div>

        {/* Scroll indicator */}
        <div style={{ padding: "8px 20px" }}>
          {scrolledToEnd ? (
            <p style={{ fontSize: 12, color: GREEN }}>✓ Вы прочитали документ</p>
          ) : (
            <p style={{ fontSize: 12, color: MUTED }}>↓ Прокрутите до конца документа</p>
          )}
        </div>

        {/* Signature canvas */}
        <div style={{ margin: "0 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, margin: 0 }}>Ваша подпись</p>
            {hasSignature && (
              <button
                onClick={clearCanvas}
                style={{
                  display:     "flex",
                  alignItems:  "center",
                  gap:         4,
                  fontSize:    12,
                  color:       MUTED,
                  background:  "none",
                  border:      "none",
                  cursor:      "pointer",
                  padding:     "4px 8px",
                  borderRadius: 6,
                }}
              >
                <RotateCcw size={12} /> Очистить
              </button>
            )}
          </div>

          <div style={{
            position:     "relative",
            borderRadius: 12,
            border:       `2px dashed ${hasSignature ? VIOLET : BORDER}`,
            overflow:     "hidden",
            background:   "#FFFFFF",
            touchAction:  "none",
          }}>
            <canvas
              ref={canvasRef}
              width={440}
              height={180}
              style={{ width: "100%", height: 180, display: "block", cursor: "crosshair", touchAction: "none" }}
            />
            {!hasSignature && (
              <div style={{
                position:   "absolute",
                inset:      0,
                display:    "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}>
                <p style={{ fontSize: 13, color: "#A1A1AA" }}>Нарисуйте подпись пальцем</p>
              </div>
            )}
          </div>
        </div>

        {/* Submit button */}
        <div style={{ margin: "20px 20px 0" }}>
          <button
            onClick={handleSubmit}
            disabled={!canSign || submitting}
            style={{
              width:        "100%",
              padding:      "14px",
              background:   canSign && !submitting ? VIOLET : "rgba(124,58,237,0.3)",
              color:        "#FFFFFF",
              border:       "none",
              borderRadius: 12,
              fontSize:     15,
              fontWeight:   700,
              cursor:       canSign && !submitting ? "pointer" : "not-allowed",
              transition:   "background 0.2s",
            }}
          >
            {submitting
              ? "Подписываем…"
              : !scrolledToEnd
                ? "Прокрутите документ вниз"
                : !hasSignature
                  ? "Поставьте подпись"
                  : "✓ Я ознакомлен и подтверждаю подпись"
            }
          </button>

          <p style={{ textAlign: "center", fontSize: 11, color: MUTED, marginTop: 12, lineHeight: 1.5 }}>
            Нажимая кнопку, вы подтверждаете ознакомление с документом и его принятие.
            Ваш IP-адрес и время подписания будут зафиксированы.
          </p>
        </div>

      </div>
    </div>
  );
}
