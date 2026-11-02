import type { Metadata } from "next";
import { PortalAppointmentsPage } from "@/src/components/PublicBooking/PortalAppointmentsPage";

export const metadata: Metadata = {
    title: "Mis citas | Patient Nova",
    robots: { index: false, follow: false },
};

export default async function AppointmentsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    return <PortalAppointmentsPage slug={slug} />;
}
