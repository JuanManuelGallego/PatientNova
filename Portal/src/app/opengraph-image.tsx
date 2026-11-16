import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The link preview (WhatsApp, LinkedIn, email, search) for every page that does not set its own.
// Generated once at build time; the colors follow the landing hero. A page that declares its own
// `openGraph` replaces the inherited image, so it must list `/opengraph-image` itself (see the landing).
export const alt = "Patient Nova: gestión clínica para profesionales de la salud";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "src/app/icon.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "linear-gradient(145deg, #7c3aed 0%, #0d2240 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> only */}
          <img src={logoSrc} width={128} height={128} alt="" style={{ background: "white", borderRadius: 32, padding: 12 }} />
          <div style={{ fontSize: 72, fontWeight: 700 }}>Patient Nova</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 52, fontWeight: 700, lineHeight: 1.15, maxWidth: 960 }}>
          La plataforma moderna para profesionales de la salud
        </div>
        <div style={{ marginTop: 24, fontSize: 30, color: "#ddd6fe", maxWidth: 960 }}>
          Pacientes, citas y recordatorios automáticos en un solo lugar.
        </div>
      </div>
    ),
    size,
  );
}
