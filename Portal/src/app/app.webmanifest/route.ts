import { webManifest } from "@/src/config/webManifest";

export const dynamic = "force-static";

export function GET() {
    return new Response(JSON.stringify(webManifest()), {
        headers: { "Content-Type": "application/manifest+json" },
    });
}
