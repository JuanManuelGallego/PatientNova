import { useCallback } from "react";
import { usePortalMutation } from "@/src/api/base/useClientMutation";
import { usePortalQuery } from "@/src/api/base/useClientQuery";
import type { PortalAppointment, PortalAppointments, PortalRescheduleRequest } from "@/src/types/PortalBooking";
import type { PublicSlots } from "@/src/types/PublicBooking";

export function usePortalAppointments() {
    const { data, ...rest } = usePortalQuery<PortalAppointments>("/appointments");
    return { appointments: data?.appointments, requests: data?.requests, ...rest };
}

const appointmentPath = (id: string) => `/appointments/${encodeURIComponent(id)}`;

export function useCancelAppointment() {
    const { mutate, ...rest } = usePortalMutation<void>();
    const cancelAppointment = useCallback((id: string) => mutate(`${appointmentPath(id)}/cancel`, {}), [ mutate ]);
    return { cancelAppointment, ...rest };
}

export function useCancelRequest() {
    const { mutate, ...rest } = usePortalMutation<void>();
    const cancelRequest = useCallback((id: string) => mutate(`/requests/${encodeURIComponent(id)}/cancel`, {}), [ mutate ]);
    return { cancelRequest, ...rest };
}

/**
 * Free times for moving one appointment (provider dates `from`..`to`). Unlike the public slots, the
 * appointment does not block its own neighbourhood and its current time is left out.
 */
export function useRescheduleSlots(appointmentId: string | null, from: string | null, to: string | null) {
    const path = appointmentId && from && to
        ? `${appointmentPath(appointmentId)}/slots?${new URLSearchParams({ from, to })}`
        : null;
    const { data, loading, error, retry } = usePortalQuery<PublicSlots>(path);
    return { slots: data, loading, error, retry };
}

export function useRescheduleAppointment() {
    const { mutate, ...rest } = usePortalMutation<{ appointment: PortalAppointment }>();
    const rescheduleAppointment = useCallback(
        (id: string, body: PortalRescheduleRequest) => mutate(`${appointmentPath(id)}/reschedule`, body),
        [ mutate ],
    );
    return { rescheduleAppointment, ...rest };
}
