import { usePublicQuery } from "@/src/api/base/useClientQuery";
import type { PublicProvider } from "@/src/types/PublicBooking";

export const useFetchPublicProvider = (slug: string) => {
    const { data, loading, error, retry } = usePublicQuery<PublicProvider>(`/providers/${encodeURIComponent(slug)}`);
    return { provider: data, loading, error, retry };
};
