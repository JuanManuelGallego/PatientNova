import type { MetadataRoute } from "next";
import { theme } from "@/src/config/theme";

export const WEB_MANIFEST_PATH = "/app.webmanifest";

export function webManifest(): MetadataRoute.Manifest {
    return {
        id: "/dashboard",
        name: "Patient Nova",
        short_name: "Patient Nova",
        description: "Pacientes, citas, calendario y recordatorios de tu consulta.",
        lang: "es",
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",
        background_color: theme.colors.background,
        theme_color: theme.themeColor.light,
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
