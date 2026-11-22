import type { Metadata } from "next";
import { WEB_MANIFEST_PATH } from "@/src/config/webManifest";

export const metadata: Metadata = {
  title: "Iniciar sesión | Patient Nova",
  robots: { index: false, follow: true },
  // Installable from the login page too: the installed app opens /dashboard, which needs the session made here.
  manifest: WEB_MANIFEST_PATH,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
