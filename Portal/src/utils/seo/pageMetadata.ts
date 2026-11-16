import type { Metadata } from "next";

export function pageMetadata({ path, title, description }: { path: string; title: string; description: string }): Metadata {
    return {
        title,
        description,
        alternates: { canonical: path },
        openGraph: {
            type: "website",
            url: path,
            siteName: "Patient Nova",
            title,
            description,
            locale: "es_CO",
            images: [ { url: "/opengraph-image", width: 1200, height: 630, alt: "Patient Nova" } ],
        },
    };
}
