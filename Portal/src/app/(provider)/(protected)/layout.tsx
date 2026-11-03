import AuthGuard from "@/src/components/AuthGuard";
import { PendingRequestsProvider } from "@/src/providers/PendingRequestsContext";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthGuard>
            <PendingRequestsProvider>{children}</PendingRequestsProvider>
        </AuthGuard>
    );
}
