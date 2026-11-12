import { useCallback } from "react";
import { publicApi } from "@/src/api/base/apiClients";
import { usePublicMutation } from "@/src/api/base/useClientMutation";
import type { BookingConfirmationView, BookingPending, StartBookingRequest } from "@/src/types/PortalBooking";

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

export function useConfirmationView() {
    const view = useCallback(
        (token: string) => publicApi.post<BookingConfirmationView>("/booking-confirmations/view", { token }),
        [],
    );
    return { view };
}

export function useConfirmBooking() {
    const { mutate, ...rest } = usePublicMutation<BookingConfirmationView>();
    const confirm = useCallback((token: string) => mutate("/booking-confirmations/confirm", { token }), [ mutate ]);
    return { confirm, ...rest };
}
