import { ApiPaginatedResponse } from "@/src/types/API";
import { useApiRequest } from "./useApiRequest";

type PaginatedData<T> = {
    items: T[];
    total: number;
    totalPages: number;
};

/** One shared empty list, so memos keyed on `items` stay stable while a query is disabled or loading. */
const NO_ITEMS: never[] = [];

export function useApiPaginatedQuery<T>(
    url: string | null,
    errorMessage?: string
) {
    const { data, loading, error, refetch } = useApiRequest<PaginatedData<T>, ApiPaginatedResponse<T>>(
        url,
        errorMessage,
        (json) => {
            if (!json.success) throw new Error("API returned an error");
            return {
                items: json.data.data,
                total: json.data.total,
                totalPages: json.data.totalPages,
            };
        }
    );

    return {
        items: data?.items ?? (NO_ITEMS as T[]),
        total: data?.total ?? 0,
        totalPages: data?.totalPages ?? 0,
        loading,
        error,
        refetch,
    };
}
