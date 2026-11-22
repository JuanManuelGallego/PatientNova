import type { Viewport } from "next";
import { AuthProvider } from "@/src/providers/AuthContext";

export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

/**
 * Provider (clinician) area: the dashboard, login and landing page. Only these routes mount the
 * AuthProvider, which probes `/users/me` (and tries a token refresh) on load. Public pages such as
 * the privacy policy and the future patient booking pages live outside this group so anonymous
 * visitors never trigger provider auth calls.
 */
export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
