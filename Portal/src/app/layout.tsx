import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/src/providers/Providers";
import { SITE_URL } from "@/src/config/site";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: [ "latin" ],
  weight: [ "400", "500", "600", "700" ],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Patient Nova",
  description: "Gestión clínica para profesionales de la salud: pacientes, citas, calendario y recordatorios.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CO" className={dmSans.className}>
      <body>
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
