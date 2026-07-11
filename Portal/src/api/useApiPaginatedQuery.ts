import { ApiPaginatedResponse } from "../types/API";
import { useApiRequest } from "./useApiRequest";

type PaginatedData<T> = {
    items: T[];
    total: number;
    totalPages: number;
};

export function useApiPaginatedQuery<T>(
    url: string,
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
        items: data?.items ?? [],
        total: data?.total ?? 0,
        totalPages: data?.totalPages ?? 0,
        loading,
        error,
        refetch,
    };
}
