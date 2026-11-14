import type { Metadata } from "next";
import { BookingConfirmationPage } from "@/src/components/PublicBooking/BookingConfirmationPage";

export const metadata: Metadata = {
    title: "Confirmar cita | Patient Nova",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
};

export default async function ConfirmBookingPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    return <BookingConfirmationPage token={token} />;
}
