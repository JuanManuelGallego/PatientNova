import { useCallback } from "react";
import { usePortalMutation } from "@/src/api/base/useClientMutation";
import { usePortalQuery } from "@/src/api/base/useClientQuery";
import type { PortalAppointment, PortalAppointments, PortalBookingRequest, PortalRescheduleRequest } from "@/src/types/PortalBooking";

export function useCreateBooking() {
    const { mutate, ...rest } = usePortalMutation<{ appointment: PortalAppointment }>();
    const createBooking = useCallback(
        async (body: PortalBookingRequest) => (await mutate("/bookings", body)).appointment,
        [ mutate ],
    );
    return { createBooking, ...rest };
}

export function usePortalAppointments() {
    const { data, ...rest } = usePortalQuery<PortalAppointments>("/appointments");
    return { appointments: data?.appointments, ...rest };
}

const appointmentPath = (id: string) => `/appointments/${encodeURIComponent(id)}`;

export function useCancelAppointment() {
    const { mutate, ...rest } = usePortalMutation<void>();
    const cancelAppointment = useCallback((id: string) => mutate(`${appointmentPath(id)}/cancel`, {}), [ mutate ]);
    return { cancelAppointment, ...rest };
}

export function useRescheduleAppointment() {
    const { mutate, ...rest } = usePortalMutation<{ appointment: PortalAppointment }>();
    const rescheduleAppointment = useCallback(
        async (id: string, body: PortalRescheduleRequest) => (await mutate(`${appointmentPath(id)}/reschedule`, body)).appointment,
        [ mutate ],
    );
    return { rescheduleAppointment, ...rest };
}
