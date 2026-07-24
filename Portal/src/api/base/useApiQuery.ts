import { ApiResponse } from "@/src/types/API";
import { useApiRequest } from "./useApiRequest";

export function useApiQuery<T>(
    url: string | null,
    errorMessage?: string
) {
    const { data, loading, error, refetch } = useApiRequest<T, ApiResponse<T>>(
        url,
        errorMessage,
        (json) => {
            if (!json.success) throw new Error("API returned an error");
            return json.data;
        }
    );

    return { data, loading, error, refetch };
}
