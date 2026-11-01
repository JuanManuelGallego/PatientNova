import type { Metadata } from "next";
import { PublicBookingPage } from "@/src/components/PublicBooking/PublicBookingPage";

// Outside the (provider) group on purpose: no AuthProvider, so no /users/me probe for anonymous patients.
export const metadata: Metadata = {
    title: "Reservar cita | Patient Nova",
    robots: { index: false, follow: false },
};

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    return <PublicBookingPage slug={slug} />;
}
