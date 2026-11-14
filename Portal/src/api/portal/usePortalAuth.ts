import { useCallback } from "react";
import { usePortalMutation } from "@/src/api/base/useClientMutation";
import { csrfStore } from "@/src/api/base/csrfStore";

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
