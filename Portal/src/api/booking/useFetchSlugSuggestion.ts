import { API_BASE } from "@/src/config/api";
import { useApiQuery } from "@/src/api/base/useApiQuery";

export const useFetchSlugSuggestion = (enabled: boolean) => {
    const { data, loading } =
        useApiQuery<{ slug: string | null }>(enabled ? `${API_BASE}/booking/slug-suggestion` : null, "Failed to load slug suggestion");
    return { suggestion: data?.slug ?? null, loading };
};
