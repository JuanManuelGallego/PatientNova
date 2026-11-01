import { useCallback } from "react";
import { usePortalMutation, usePublicMutation } from "@/src/api/base/useClientMutation";
import { csrfStore } from "@/src/api/base/csrfStore";
import type { OtpChallenge, PortalLogin } from "@/src/types/PortalSession";

const providerPath = (slug: string) => `/providers/${encodeURIComponent(slug)}`;

/** Always answers the same 202 `{ challenge }`, whether or not a code was sent. */
export function useRequestOtp(slug: string) {
    const { mutate, ...rest } = usePublicMutation<OtpChallenge>();
    const requestOtp = useCallback(
        (email: string, captchaToken: string) => mutate(`${providerPath(slug)}/otp`, { email, captchaToken }),
        [ mutate, slug ],
    );
    return { requestOtp, ...rest };
}

/** Sets the session cookie; `portalApi` keeps the returned CSRF token in memory. */
export function useVerifyOtp(slug: string) {
    const { mutate, ...rest } = usePortalMutation<PortalLogin>();
    const verifyOtp = useCallback(
        (email: string, code: string, challenge: string) =>
            mutate(`/${encodeURIComponent(slug)}/otp/verify`, { email, code, challenge }),
        [ mutate, slug ],
    );
    return { verifyOtp, ...rest };
}

/** Always 204: the server records consent only when the session matches a patient. */
export function useAcceptConsent() {
    const { mutate, ...rest } = usePortalMutation<void>();
    const acceptConsent = useCallback(() => mutate("/consent", { accepted: true }), [ mutate ]);
    return { acceptConsent, ...rest };
}

/** Clears the cookie server-side; the CSRF token is dropped only once that succeeded. */
export function useLogout() {
    const { mutate, ...rest } = usePortalMutation<void>();
    const logout = useCallback(async () => {
        await mutate("/logout");
        csrfStore.clear();
    }, [ mutate ]);
    return { logout, ...rest };
}
