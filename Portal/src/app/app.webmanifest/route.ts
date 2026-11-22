import { webManifest } from "@/src/config/webManifest";

// Built once at build time; the content only changes with a deploy.
export const dynamic = "force-static";

export function GET() {
    return new Response(JSON.stringify(webManifest()), {
        headers: { "Content-Type": "application/manifest+json" },
    });
}
