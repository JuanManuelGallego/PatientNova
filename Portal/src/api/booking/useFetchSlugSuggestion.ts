import { API_BASE } from "@/src/config/api";
import { useApiQuery } from "@/src/api/base/useApiQuery";

/** Pass `enabled=false` to skip the request (e.g. the provider already has a slug). */
export const useFetchSlugSuggestion = (enabled: boolean) => {
    const { data, loading } =
        useApiQuery<{ slug: string | null }>(enabled ? `${API_BASE}/booking/slug-suggestion` : null, "Failed to load slug suggestion");
    return { suggestion: data?.slug ?? null, loading };
};
