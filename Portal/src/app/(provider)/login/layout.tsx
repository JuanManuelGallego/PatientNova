import type { Metadata } from "next";

// The login page is a client component and cannot export metadata, so it lives here. `noindex`
// keeps a search for "Patient Nova" on the landing page; the page stays crawlable (not in
// robots.txt) so crawlers can read the tag.
export const metadata: Metadata = {
  title: "Iniciar sesión | Patient Nova",
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
