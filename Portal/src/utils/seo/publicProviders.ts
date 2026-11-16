import { API_BASE } from "@/src/config/api";
import type { PublicProvider } from "@/src/types/PublicBooking";

const REVALIDATE_SECONDS = 300;
const TIMEOUT_MS = 3000;

async function getData<T>(path: string): Promise<T | null> {
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            next: { revalidate: REVALIDATE_SECONDS },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { success?: boolean; data?: T };
        return json.success ? (json.data ?? null) : null;
    } catch {
        return null;
    }
}

export function fetchPublicProvider(slug: string): Promise<PublicProvider | null> {
    return getData<PublicProvider>(`/public/providers/${encodeURIComponent(slug)}`);
}

export async function fetchIndexableProviderSlugs(): Promise<string[]> {
    const data = await getData<{ providers: Array<{ slug: string }> }>("/public/providers");
    return data?.providers.map((p) => p.slug) ?? [];
}
