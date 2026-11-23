import type { Metadata } from "next";
import { WEB_MANIFEST_PATH } from "@/src/config/webManifest";
import ServiceWorkerRegistrar from "@/src/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "Iniciar sesión | Patient Nova",
  robots: { index: false, follow: true },
  manifest: WEB_MANIFEST_PATH,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorkerRegistrar />
      {children}
    </>
  );
}
