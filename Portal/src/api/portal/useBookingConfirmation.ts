import { useCallback } from "react";
import { usePublicMutation } from "@/src/api/base/useClientMutation";
import type { BookingPending, StartBookingRequest } from "@/src/types/PortalBooking";

export function useStartBooking(slug: string) {
    const { mutate, ...rest } = usePublicMutation<BookingPending>();
    const startBooking = useCallback(
        (body: StartBookingRequest) => mutate(`/providers/${encodeURIComponent(slug)}/bookings`, body),
        [ mutate, slug ],
    );
    return { startBooking, ...rest };
}

export function useReleaseBooking() {
    const { mutate, ...rest } = usePublicMutation<void>();
    const release = useCallback((releaseToken: string) => mutate("/booking-confirmations/release", { releaseToken }), [ mutate ]);
    return { release, ...rest };
}
