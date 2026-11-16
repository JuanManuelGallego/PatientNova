import type { MetadataRoute } from "next";
import { INDEXABLE_PATHS, SITE_URL } from "@/src/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PATHS.map((path) => ({ url: `${SITE_URL}${path}` }));
}
