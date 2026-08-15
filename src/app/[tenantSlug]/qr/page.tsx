import { notFound } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { fetchRestaurantBySlug } from "@/lib/fetch-menu";

export const dynamic = "force-dynamic";

function QrCard({
  restaurantName,
  title,
  cta,
  ctaSub,
  menuUrl,
}: {
  restaurantName: string;
  title: string;
  cta: string;
  ctaSub: string;
  menuUrl: string;
}) {
  return (
    <div
      className="qr-page"
      style={{
        minHeight: "100vh",
        background: "#F5F5F5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily:
          "var(--font-geist-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "20px",
          padding: "48px 40px 40px",
          maxWidth: "380px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
          boxShadow: "0 2px 24px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              margin: "0 0 10px",
              fontSize: "13px",
              color: "#888",
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {restaurantName}
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: "52px",
              fontWeight: 800,
              color: "#111",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {title}
          </h1>
        </div>

        <div
          style={{
            width: "40px",
            height: "2px",
            background: "#111",
            borderRadius: "2px",
          }}
        />

        <div
          style={{
            padding: "16px",
            background: "#FFFFFF",
            border: "1px solid #E5E5E5",
            borderRadius: "12px",
          }}
        >
          <QRCodeSVG
            value={menuUrl}
            size={220}
            level="H"
            marginSize={0}
            fgColor="#111111"
            imageSettings={{ src: "", height: 0, width: 0, excavate: false }}
          />
        </div>

        <div style={{ textAlign: "center" }}>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: "16px",
              fontWeight: 600,
              color: "#111",
            }}
          >
            {cta}
          </p>
          <p style={{ margin: 0, fontSize: "13px", color: "#888" }}>{ctaSub}</p>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: "11px",
            color: "#bbb",
            letterSpacing: "0.04em",
          }}
        >
          Powered by ScanServe
        </p>
      </div>
    </div>
  );
}

export default async function TenantQrPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const restaurant = await fetchRestaurantBySlug(tenantSlug);
  if (!restaurant) notFound();

  const origin = "https://scanserve-qr-production-2cff.up.railway.app";
  const menuUrl = `${origin}/${tenantSlug}?source=qr`;
  const name = restaurant.name ?? tenantSlug;

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { margin: 0; }
          .qr-page { min-height: 100vh; page-break-after: always; break-after: page; }
          .qr-page:last-child { page-break-after: avoid; break-after: avoid; }
        }
        @media screen {
          .qr-page + .qr-page {
            border-top: 2px dashed #ddd;
          }
        }
      `}</style>

      <QrCard
        restaurantName={name}
        title="МӘЗІР"
        cta="QR-кодты сканерлеңіз"
        ctaSub="мәзірді телефонда ашу үшін"
        menuUrl={menuUrl}
      />

      <QrCard
        restaurantName={name}
        title="MENU"
        cta="Scan the QR code"
        ctaSub="to open the menu on your phone"
        menuUrl={menuUrl}
      />
    </>
  );
}
