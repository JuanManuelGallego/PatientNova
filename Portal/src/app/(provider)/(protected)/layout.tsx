import AuthGuard from "@/src/components/AuthGuard";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    return <AuthGuard>{children}</AuthGuard>;
}
