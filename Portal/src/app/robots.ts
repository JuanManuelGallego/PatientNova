import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/config/site";

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
