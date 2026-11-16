import type { Metadata } from "next";
import { PublicBookingPage } from "@/src/components/PublicBooking/PublicBookingPage";
import { API_BASE } from "@/src/config/api";
import { fetchPublicProvider } from "@/src/utils/seo/publicProviders";
import type { PublicProvider } from "@/src/types/PublicBooking";

const NOT_INDEXED: Metadata = {
    title: "Reservar cita | Patient Nova",
    robots: { index: false, follow: false },
};

const DESCRIPTION_MAX = 155;

function describe(p: PublicProvider): string {
    const bio = p.bio?.replace(/\s+/g, " ").trim();
    if (bio) return bio.length > DESCRIPTION_MAX ? `${bio.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : bio;
    const role = p.specialty ?? p.jobTitle;
    return `Reserva en línea tu cita con ${p.displayName}${role ? `, ${role}` : ""}.`;
}

/**
 * `noindex` unless the provider opted in and booking is open (`indexable`, decided by the API). Any
 * failure to read the profile keeps the page out of search: indexing is never the fallback.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const slug = (await params).slug.toLowerCase();
    const provider = await fetchPublicProvider(slug);
    if (!provider?.indexable) return NOT_INDEXED;

    const role = provider.specialty ?? provider.jobTitle;
    const title = `${provider.displayName}${role ? ` · ${role}` : ""} | Reservar cita`;
    const description = describe(provider);
    const path = `/book/${slug}`;
    return {
        title,
        description,
        robots: { index: true, follow: true },
        alternates: { canonical: path },
        openGraph: {
            type: "profile",
            url: path,
            siteName: "Patient Nova",
            title,
            description,
            locale: "es_CO",
            images: provider.hasAvatar
                ? [ { url: `${API_BASE}/public/providers/${slug}/avatar`, alt: provider.displayName } ]
                : [ { url: "/opengraph-image", width: 1200, height: 630, alt: "Patient Nova" } ],
        },
    };
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    return <PublicBookingPage slug={slug} />;
}
