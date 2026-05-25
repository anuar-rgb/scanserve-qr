"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

interface PrintData {
  restaurantName: string;
  document:       { title: string; content: string };
  staffName:      string;
  signatureImage: string | null;
  signedAt:       string | null;
  ipAddress:      string | null;
  phoneNumber:    string | null;
  deviceModel:    string | null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const todayStr = new Date().toLocaleDateString("ru-RU", {
  day: "2-digit", month: "long", year: "numeric",
});

export default function PrintSignaturePage() {
  const params  = useSearchParams();
  const docId   = params.get("docId");
  const staffId = params.get("staffId");

  const [data,  setData]  = useState<PrintData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId || !staffId) { setError("Неверные параметры"); return; }
    fetch(`/api/admin/documents/print-data?docId=${docId}&staffId=${staffId}`)
      .then((r) => r.json())
      .then((d: PrintData & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("Не удалось загрузить данные"));
  }, [docId, staffId]);

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial, sans-serif", textAlign: "center" }}>
        <p style={{ color: "#dc2626", fontSize: 16 }}>Ошибка: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial, sans-serif", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", gap: 12 }}>
        <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "#7C3AED" }} />
        <p style={{ color: "#666", fontSize: 14 }}>Загружаем документ…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
        }
        @page { margin: 18mm 20mm; size: A4; }
        body { font-family: Arial, Helvetica, sans-serif; background: white; color: #111; }
        * { box-sizing: border-box; }
      `}</style>

      {/* Floating print button */}
      <div className="no-print" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", gap: 10 }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: "11px 22px",
            background: "#7C3AED",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(124,58,237,0.45)",
            letterSpacing: 0.3,
          }}
        >
          📥 Сохранить PDF / Печать
        </button>
      </div>

      {/* Document */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 48px 64px" }}>

        {/* Letterhead */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #111", paddingBottom: 16, marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "#888", margin: "0 0 6px" }}>
              Цифровой трудовой документ
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#333", margin: 0 }}>
              {data.restaurantName}
            </p>
          </div>
          <p style={{ fontSize: 11, color: "#888", margin: 0, textAlign: "right", lineHeight: 1.5 }}>
            Дата формирования:<br />
            <strong style={{ color: "#333" }}>{todayStr}</strong>
          </p>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 20, fontWeight: 700, textAlign: "center", margin: "0 0 32px", lineHeight: 1.3 }}>
          {data.document.title}
        </h1>

        {/* Body */}
        <div style={{
          fontSize: 13,
          lineHeight: 1.75,
          color: "#222",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          marginBottom: 48,
          borderLeft: "3px solid #e5e7eb",
          paddingLeft: 16,
        }}>
          {data.document.content}
        </div>

        {/* Signatures block */}
        <div style={{ borderTop: "2px solid #111", paddingTop: 24 }}>
          <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color: "#555", margin: "0 0 24px" }}>
            Подписи сторон
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                {/* Employer */}
                <td style={{ width: "48%", verticalAlign: "top", paddingRight: 20, borderRight: "1px solid #d1d5db" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#888", margin: "0 0 14px" }}>
                    Работодатель
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", color: "#111" }}>
                    {data.restaurantName}
                  </p>

                  {/* "Verified" stamp block */}
                  <div style={{
                    border: "2px solid #16a34a",
                    borderRadius: 8,
                    padding: "12px 14px",
                    background: "#f0fdf4",
                    display: "inline-block",
                    marginBottom: 14,
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#15803d", margin: "0 0 4px", letterSpacing: 0.5 }}>
                      ✅ ПОДПИСАНО В СИСТЕМЕ
                    </p>
                    <p style={{ fontSize: 11, color: "#166534", margin: 0 }}>
                      {data.signedAt ? fmt(data.signedAt) : "—"}
                    </p>
                  </div>

                  <p style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.55, margin: 0 }}>
                    Подпись зафиксирована автоматически с помощью сервиса цифрового подписания ScanServe CRM
                  </p>
                </td>

                {/* Employee */}
                <td style={{ width: "52%", verticalAlign: "top", paddingLeft: 20 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#888", margin: "0 0 14px" }}>
                    Работник
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 14px", color: "#111" }}>
                    {data.staffName}
                  </p>

                  {/* Handwritten signature */}
                  {data.signatureImage ? (
                    <div style={{
                      border: "1.5px solid #d1d5db",
                      borderRadius: 8,
                      background: "#fff",
                      padding: 8,
                      marginBottom: 14,
                      textAlign: "center",
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={data.signatureImage}
                        alt="Рукописная подпись"
                        style={{ maxWidth: "100%", maxHeight: 100, objectFit: "contain", display: "block", margin: "0 auto" }}
                      />
                    </div>
                  ) : (
                    <div style={{ border: "1.5px dashed #d1d5db", borderRadius: 8, padding: "20px 0", textAlign: "center", marginBottom: 14 }}>
                      <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Изображение подписи недоступно</p>
                    </div>
                  )}

                  {/* Verification metadata */}
                  <div style={{ fontSize: 11, color: "#555", lineHeight: 2 }}>
                    {data.phoneNumber && (
                      <p style={{ margin: 0 }}>
                        <span style={{ color: "#888" }}>Телефон:</span>{" "}
                        <strong style={{ color: "#111" }}>{data.phoneNumber}</strong>
                      </p>
                    )}
                    {data.deviceModel && (
                      <p style={{ margin: 0 }}>
                        <span style={{ color: "#888" }}>Устройство:</span>{" "}
                        <strong style={{ color: "#111" }}>{data.deviceModel}</strong>
                      </p>
                    )}
                    {data.ipAddress && data.ipAddress !== "unknown" && (
                      <p style={{ margin: 0 }}>
                        <span style={{ color: "#888" }}>IP-адрес:</span>{" "}
                        <strong style={{ fontFamily: "monospace", fontSize: 11, color: "#111" }}>{data.ipAddress}</strong>
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 14, borderTop: "1px solid #e5e7eb", textAlign: "center" }}>
          <p style={{ fontSize: 9, color: "#9ca3af", margin: 0, lineHeight: 1.6 }}>
            Документ автоматически сгенерирован системой ScanServe CRM · {todayStr}
            <br />
            Подпись является юридически действительной в соответствии с законодательством об электронной подписи.
          </p>
        </div>

      </div>
    </>
  );
}
