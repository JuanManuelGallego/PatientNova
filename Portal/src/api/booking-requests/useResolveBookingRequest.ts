import { useCallback } from "react";
import { API_BASE } from "@/src/config/api";
import { useApiMutation } from "@/src/api/base/useApiMutation";
import type { ApproveBookingRequestBody, BookingRequestDetail } from "@/src/types/BookingRequest";

export function useResolveBookingRequest() {
    const { mutate, loading, error } = useApiMutation<BookingRequestDetail>("POST", "No pudimos actualizar la solicitud");

    const approve = useCallback(
        (id: string, body: ApproveBookingRequestBody = {}) => mutate(`${API_BASE}/booking-requests/${id}/approve`, body),
        [ mutate ],
    );
    const reject = useCallback(
        (id: string) => mutate(`${API_BASE}/booking-requests/${id}/reject`, {}),
        [ mutate ],
    );

    return { approve, reject, loading, error };
}
