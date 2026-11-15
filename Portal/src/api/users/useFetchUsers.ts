import { API_BASE } from "@/src/config/api";
import { ManagedUser } from "@/src/types/User";
import { useApiQuery } from "@/src/api/base/useApiQuery";

export const useFetchUsers = ({ includeDeleted }: { includeDeleted: boolean }) => {
    const url = `${API_BASE}/users${includeDeleted ? "?includeDeleted=true" : ""}`;
    const { data, loading, error, refetch } = useApiQuery<ManagedUser[]>(url, "Failed to load users");
    return { users: data ?? undefined, loading, error, refetch };
};
