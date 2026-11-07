import Link from "next/link";
import { consentLabel, consentNotice, controllerLine } from "@/src/config/consentText";
import type { PublicProvider } from "@/src/types/PublicBooking";
import styles from "./Portal.module.css";

/** What the patient reads before authorizing. It stays beside the checkbox, never behind a link. */
export function ConsentNotice({ provider }: { provider: PublicProvider }) {
    return (
        <>
            <p className={styles.lead} data-testid="consent-controller">{controllerLine(provider)}</p>
            <p className={styles.lead} data-testid="consent-notice">{consentNotice(provider)}</p>
        </>
    );
}

export function ConsentLabel({ provider }: { provider: PublicProvider }) {
    return (
        <span>
            {consentLabel(provider)}{" "}
            <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">Política de privacidad</Link>.
        </span>
    );
}
