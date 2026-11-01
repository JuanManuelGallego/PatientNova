import { usePublicQuery } from "@/src/api/base/usePublicQuery";
import type { PublicSlots } from "@/src/types/PublicBooking";

/** Pass `null` for `typeId` until a type is chosen; nothing is fetched then. */
export const useFetchPublicSlots = (slug: string, typeId: string | null, from: string | null, to: string | null) => {
    const path = typeId && from && to
        ? `/providers/${encodeURIComponent(slug)}/slots?${new URLSearchParams({ typeId, from, to })}`
        : null;
    const { data, loading, error, retry } = usePublicQuery<PublicSlots>(path);
    return { slots: data, loading, error, retry };
};
