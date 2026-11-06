import { useCallback } from "react";
import { usePortalMutation, usePublicMutation } from "@/src/api/base/useClientMutation";
import { csrfStore } from "@/src/api/base/csrfStore";
import type { OtpChallenge, OtpRequestContact, OtpVerifyContact, PortalLogin } from "@/src/types/PortalSession";

const providerPath = (slug: string) => `/providers/${encodeURIComponent(slug)}`;

export function useRequestOtp(slug: string) {
    const { mutate, ...rest } = usePublicMutation<OtpChallenge>();
    const requestOtp = useCallback(
        (contact: OtpRequestContact, captchaToken: string) => mutate(`${providerPath(slug)}/otp`, { ...contact, captchaToken }),
        [ mutate, slug ],
    );
    return { requestOtp, ...rest };
}

export function useVerifyOtp(slug: string) {
    const { mutate, ...rest } = usePortalMutation<PortalLogin>();
    const verifyOtp = useCallback(
        (contact: OtpVerifyContact, code: string, challenge: string) =>
            mutate(`/${encodeURIComponent(slug)}/otp/verify`, { ...contact, code, challenge }),
        [ mutate, slug ],
    );
    return { verifyOtp, ...rest };
}

export function useAcceptConsent() {
    const { mutate, ...rest } = usePortalMutation<void>();
    const acceptConsent = useCallback(() => mutate("/consent", { accepted: true }), [ mutate ]);
    return { acceptConsent, ...rest };
}

export function useLogout() {
    const { mutate, ...rest } = usePortalMutation<void>();
    const logout = useCallback(async () => {
        await mutate("/logout");
        csrfStore.clear();
    }, [ mutate ]);
    return { logout, ...rest };
}
