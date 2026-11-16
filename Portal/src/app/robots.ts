import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/config/site";

/**
 * `/book` stays crawlable on purpose: its pages are `noindex`, and a crawler only learns that by
 * fetching them. A Disallow would hide the tag and let bare links still be indexed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/patients",
        "/appointments",
        "/calendar",
        "/reminders",
        "/settings",
        "/medical-records",
        "/requests",
        "/activity",
        "/admin",
        "/google",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
