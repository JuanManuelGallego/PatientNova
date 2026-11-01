import { PublicBookingPage } from "@/src/components/PublicBooking/PublicBookingPage";

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    return <PublicBookingPage slug={slug} />;
}
