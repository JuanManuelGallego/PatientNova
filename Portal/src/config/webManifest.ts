import type { MetadataRoute } from "next";
import { theme } from "@/src/config/theme";

/**
 * Where the manifest is served (src/app/app.webmanifest/route.ts). Deliberately not the app-root `manifest.ts`
 * metadata file: Next would link that from every page, so patients on /book could be offered to install the
 * provider app. Only the provider layouts (protected pages and login) set `metadata.manifest` to this path.
 */
export const WEB_MANIFEST_PATH = "/app.webmanifest";

/**
 * The installed provider app opens on the dashboard (the login redirect covers a missing session).
 * Scope "/": provider pages sit at the root (/dashboard, /patients, /login...), and a scope must contain
 * start_url, so no narrower scope can leave /book out. Patients never get the install offer because the
 * manifest is linked from provider pages only; on a provider's own phone the installed app may open
 * /book links, which still work there.
 * The icons in public/icons come from `node scripts/generate-app-icons.mjs`.
 */
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
        // The splash screen uses the page background; the title bar matches the app's white top bar.
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
