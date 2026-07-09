import { useCallback } from "react";
import { API_BASE } from "../types/API";
import { useApiMutation } from "./useApiMutation";

interface EntityMutationConfig {
    resource: string;
    name: string;
    errorMessage: string;
}

interface MutationResult {
    loading: boolean;
    error: string | null;
}

export function createEntityCreate<T>({ resource, name, errorMessage }: EntityMutationConfig) {
    return () => {
        const { mutate, loading, error } = useApiMutation<T>("POST", errorMessage);
        const create = useCallback(
            (data: Partial<T>) => mutate(`${API_BASE}/${resource}`, data),
            [ mutate ],
        );
        const result: MutationResult & Record<`create${typeof name}`, typeof create> = {
            loading,
            error,
        };
        result[ `create${name}` as `create${typeof name}` ] = create;
        return result;
    };
}

export function createEntityUpdate<T>({ resource, name, errorMessage }: EntityMutationConfig) {
    return () => {
        const { mutate, loading, error } = useApiMutation<T>("PATCH", errorMessage);
        const update = useCallback(
            (id: string, data: Partial<T>) => mutate(`${API_BASE}/${resource}/${id}`, data),
            [ mutate ],
        );
        const result: MutationResult & Record<`update${typeof name}`, typeof update> = {
            loading,
            error,
        };
        result[ `update${name}` as `update${typeof name}` ] = update;
        return result;
    };
}

export function createEntityDelete({ resource, name, errorMessage }: EntityMutationConfig) {
    return () => {
        const { mutate, loading, error } = useApiMutation("DELETE", errorMessage);
        const remove = useCallback(
            async (id: string) => { await mutate(`${API_BASE}/${resource}/${id}`); return true as const; },
            [ mutate ],
        );
        const result: MutationResult & Record<`delete${typeof name}`, typeof remove> = {
            loading,
            error,
        };
        result[ `delete${name}` as `delete${typeof name}` ] = remove;
        return result;
    };
}
