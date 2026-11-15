import { API_BASE } from "@/src/config/api";
import { User } from "@/src/types/User";
import { useApiMutation } from "@/src/api/base/useApiMutation";
import { createEntityCreate, createEntityUpdate } from "@/src/api/base/useEntityMutation";

export const useCreateUser = createEntityCreate<User>({
    resource: "users",
    name: "User",
    errorMessage: "Failed to create user",
});

export const useUpdateUser = createEntityUpdate<User>({
    resource: "users",
    name: "User",
    errorMessage: "Failed to update user",
});

export function useDeleteUser() {
    const { mutate, loading, error } = useApiMutation<User>("POST");
    return { deleteUser: (id: string) => mutate(`${API_BASE}/users/${id}/delete`), loading, error };
}

export function useRestoreUser() {
    const { mutate, loading, error } = useApiMutation<User>("POST");
    return { restoreUser: (id: string) => mutate(`${API_BASE}/users/${id}/restore`), loading, error };
}
