import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { PublicProvider } from "@/src/types/PublicBooking";
import { ProviderAvatar } from "./ProviderAvatar";
import styles from "./ProviderProfile.module.css";

interface ProviderHeaderProps {
    slug: string;
    provider: PublicProvider;
    /** The form used after the first step: it drops to the name, to save room. */
    compact?: boolean;
    appointmentsHref?: string | undefined;
    onOpenProfile?: (() => void) | undefined;
    onBack?: (() => void) | undefined;
}

/** Phones only: desktop has the whole profile in `ProviderPanel`. */
export function ProviderHeader({ slug, provider, compact = false, appointmentsHref, onOpenProfile, onBack }: ProviderHeaderProps) {
    const role = [ provider.jobTitle, provider.specialty ].filter(Boolean).join(" · ");
    return (
        <header className={styles.header} data-compact={compact || undefined}>
            <ProviderAvatar slug={slug} provider={provider} className={styles.headerPhoto} />
            <div className={styles.who}>
                <h1 className={styles.headerName}>
                    {compact && onOpenProfile
                        ? <button type="button" className={styles.nameButton} onClick={onOpenProfile}>{provider.displayName}</button>
                        : provider.displayName}
                </h1>
                {role && <p className={styles.headerRole}>{role}</p>}
                {onOpenProfile && <button type="button" className={styles.profileLink} onClick={onOpenProfile}>Ver perfil</button>}
            </div>
            {onBack && (
                <button type="button" className={styles.headerAction} onClick={onBack}>
                    <ChevronLeft size={18} aria-hidden="true" />Atrás
                </button>
            )}
            {appointmentsHref && <Link href={appointmentsHref} className={`${styles.headerAction} ${styles.appointmentsLink}`}>Mis citas</Link>}
        </header>
    );
}
