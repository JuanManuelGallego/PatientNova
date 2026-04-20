import Sidebar from "@/src/components/Sidebar";

/** Wraps the standard page-shell (sidebar + main content area). */
export default function PageLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="page-shell">
            <Sidebar />
            <main className="page-main">{children}</main>
        </div>
    );
}
