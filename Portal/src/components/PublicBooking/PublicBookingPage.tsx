"use client";

import Link from "next/link";
import { CalendarOff } from "lucide-react";
import { useFetchPublicProvider } from "@/src/api/public-booking/useFetchPublicProvider";
import type { PublicProvider } from "@/src/types/PublicBooking";
import { appointmentsPath } from "@/src/utils/publicBooking";
import { BookingFlow } from "./BookingFlow";
import styles from "./PublicBooking.module.css";
import { ProviderProfile } from "./ProviderProfile";
import { ErrorState, PublicPageShell, Unavailable } from "./PublicStates";
import { StateIcon } from "./PublicChrome";

export function PublicBookingPage({ slug }: { slug: string }) {
    const { provider, loading, error, retry } = useFetchPublicProvider(slug);

    let body: React.ReactNode;
    if (error?.status === 404) body = <Unavailable />;
    else if (error) body = <ErrorState error={error} onRetry={retry} />;
    else if (loading || !provider) body = <ProfileSkeleton />;
    else if (!provider.bookingOpen) body = <BookingPaused slug={slug} provider={provider} />;
    else body = <BookingFlow slug={slug} provider={provider} />;

    return <PublicPageShell wide={provider?.bookingOpen === true && !error}>{body}</PublicPageShell>;
}

function BookingPaused({ slug, provider }: { slug: string; provider: PublicProvider }) {
    return (
        <>
            <section className={`dash-card ${styles.pausedProfile}`}>
                <ProviderProfile slug={slug} provider={provider} headingLevel={1} />
            </section>
            <section className={`dash-card ${styles.state}`} data-testid="booking-paused">
                <StateIcon icon={CalendarOff} />
                <h2 className={styles.stateTitle}>Las reservas en línea están en pausa</h2>
                <p className={styles.muted}>
                    Por ahora no es posible reservar nuevas citas en línea. Si ya tienes una cita, puedes verla o cancelarla.
                </p>
                <Link href={appointmentsPath(slug)} className="btn-primary">Ver mis citas</Link>
            </section>
        </>
    );
}

function ProfileSkeleton() {
    return (
        <section className={styles.hero} aria-busy="true" aria-label="Cargando">
            <div className={styles.card}>
                <div className={`skeleton-bar ${styles.portraitSkeleton}`} />
                <div className={`${styles.intro} ${styles.skeletonLines}`}>
                    <div className="skeleton-bar" style={{ width: "70%", height: 32 }} />
                    <div className="skeleton-bar" style={{ width: "40%" }} />
                </div>
            </div>
        </section>
    );
}
