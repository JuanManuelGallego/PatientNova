import AuthGuard from "@/src/components/AuthGuard";
import { PendingRequestsProvider } from "@/src/providers/PendingRequestsContext";
import { SettingsAttentionProvider } from "@/src/providers/SettingsAttentionContext";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthGuard>
            <PendingRequestsProvider>
                <SettingsAttentionProvider>{children}</SettingsAttentionProvider>
            </PendingRequestsProvider>
        </AuthGuard>
    );
}
