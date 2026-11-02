import { useCallback } from "react";
import { usePortalMutation } from "@/src/api/base/useClientMutation";
import { usePortalQuery } from "@/src/api/base/useClientQuery";
import type { PortalAppointment, PortalAppointments, PortalBookingRequest } from "@/src/types/PortalBooking";

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
