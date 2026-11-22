import type { Metadata } from "next";
import AuthGuard from "@/src/components/AuthGuard";
import { PendingRequestsProvider } from "@/src/providers/PendingRequestsContext";
import { SettingsAttentionProvider } from "@/src/providers/SettingsAttentionContext";
import { WEB_MANIFEST_PATH } from "@/src/config/webManifest";

// The installed app (manifest start_url /dashboard) lives on these pages, so only they and the login page link
// the manifest. The browser bar colour is rendered by PageLayout, which follows the provider's theme.
export const metadata: Metadata = {
    manifest: WEB_MANIFEST_PATH,
    appleWebApp: { capable: true, title: "Patient Nova", statusBarStyle: "default" },
};

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthGuard>
            <PendingRequestsProvider>
                <SettingsAttentionProvider>{children}</SettingsAttentionProvider>
            </PendingRequestsProvider>
        </AuthGuard>
    );
}
