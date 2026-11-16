import type { MetadataRoute } from "next";
import { INDEXABLE_PATHS, SITE_URL } from "@/src/config/site";
import { fetchIndexableProviderSlugs } from "@/src/utils/seo/publicProviders";

// Rebuilt at most hourly: opted-in providers join or leave without a deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const providers = await fetchIndexableProviderSlugs();
    return [
        ...INDEXABLE_PATHS.map((path) => ({ url: `${SITE_URL}${path}` })),
        ...providers.map((slug) => ({ url: `${SITE_URL}/book/${slug}` })),
    ];
}
