"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, Video } from "lucide-react";
import { useFetchPublicProvider } from "@/src/api/public-booking/useFetchPublicProvider";
import type { PublicProvider } from "@/src/types/PublicBooking";
import type { PortalAppointment, PortalBookingOutcome, PortalPendingRequest } from "@/src/types/PortalBooking";
import { browserTimezone } from "@/src/utils/TimeUtils";
import { fmtCop, locationDetail, timezoneName } from "@/src/utils/publicBooking";
import styles from "./PublicBooking.module.css";
import { ErrorState, PublicPageShell, Unavailable } from "./PublicStates";
import { ProviderAvatar, providerImageUrl } from "./ProviderAvatar";
import { BookingForm } from "./BookingForm";
import { PortalAppointmentCard } from "./PortalAppointmentCard";
import { PortalRequestCard } from "./PortalRequestCard";
import { reveal, SlotSteps, Step, useSlotPicker } from "./SlotPicker";

export function PublicBookingPage({ slug }: { slug: string }) {
    const { provider, loading, error, retry } = useFetchPublicProvider(slug);

    let body: React.ReactNode;
    if (error?.status === 404) body = <Unavailable />;
    else if (error) body = <ErrorState error={error} onRetry={retry} />;
    else if (loading || !provider) body = <ProfileSkeleton />;
    else if (!provider.bookingOpen) body = <BookingPaused slug={slug} provider={provider} />;
    else body = <BookingView slug={slug} provider={provider} />;

    return <PublicPageShell>{body}</PublicPageShell>;
}

const appointmentsPath = (slug: string) => `/book/${encodeURIComponent(slug)}/appointments`;

function BookingPaused({ slug, provider }: { slug: string; provider: PublicProvider }) {
    return (
        <>
            <ProviderHero slug={slug} provider={provider} />
            <section className={`dash-card ${styles.state}`} data-testid="booking-paused">
                <h2 className={styles.stateTitle}>Las reservas en línea están en pausa</h2>
                <p className={styles.muted}>
                    Por ahora no es posible reservar nuevas citas en línea. Si ya tienes una cita, puedes verla o cancelarla.
                </p>
                <Link href={appointmentsPath(slug)} className="btn-primary">Ver mis citas</Link>
            </section>
        </>
    );
}

function BookingView({ slug, provider }: { slug: string; provider: PublicProvider }) {
    const timezone = browserTimezone();
    const [ typeId, setTypeId ] = useState<string | null>(null);
    const [ booked, setBooked ] = useState<PortalBookingOutcome | null>(null);

    const type = provider.types.find((t) => t.id === typeId) ?? provider.types[ 0 ];
    const picker = useSlotPicker(slug, provider, { typeId: type?.id ?? null }, timezone);
    const { slot, notice, error } = picker;
    const pickedStart = slot?.startUtc;
    const confirmStep = useRef<HTMLDivElement>(null);
    const slotNoticeRef = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        if (pickedStart) reveal(confirmStep.current);
    }, [ pickedStart ]);

    useEffect(() => {
        if (notice) slotNoticeRef.current?.focus();
    }, [ notice ]);

    if (error?.status === 404) return <Unavailable />;

    const bookAnother = () => {
        setBooked(null);
        picker.pick(null);
        picker.retry();
    };

    const nav = (
        <nav className={styles.topNav} aria-label="Cuenta">
            <Link href={appointmentsPath(slug)} className={styles.topLink}>Mis citas</Link>
        </nav>
    );

    if (booked) {
        return (
            <>
                {nav}
                <ProviderHero slug={slug} provider={provider} />
                {"request" in booked
                    ? <RequestSent slug={slug} request={booked.request} timezone={timezone} onBookAnother={bookAnother} />
                    : <BookingDone slug={slug} appointment={booked.appointment} timezone={timezone} onBookAnother={bookAnother} />}
            </>
        );
    }

    return (
        <>
            {nav}
            <ProviderHero slug={slug} provider={provider} />

            <section className={`dash-card ${styles.flow}`} aria-label="Horarios disponibles">
                <Step number={1} title="Tipo de cita">
                    <div className={styles.options}>
                        {provider.types.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                className={styles.option}
                                aria-pressed={t.id === type?.id}
                                onClick={() => { setTypeId(t.id); picker.clearSelection(); }}
                            >
                                <span className={styles.optionHead}>
                                    <span className={styles.optionName}>{t.name}</span>
                                    {t.price !== null && <span className={styles.optionPrice}>{fmtCop(t.price)}</span>}
                                </span>
                                <span className={styles.optionMeta}>{t.durationMinutes} minutos</span>
                                {t.description && <span className={styles.optionMeta}>{t.description}</span>}
                            </button>
                        ))}
                    </div>
                </Step>

                <SlotSteps picker={picker} firstStep={2} noticeRef={slotNoticeRef} />

                {slot && type && (
                    <Step number={4} title="Confirma tu cita" stepRef={confirmStep}>
                        <BookingForm key={slot.startUtc} slug={slug} provider={provider} type={type} slot={slot} timezone={timezone}
                            onBooked={setBooked} onSlotTaken={picker.slotTaken} />
                    </Step>
                )}
            </section>
        </>
    );
}

function ProviderHero({ slug, provider }: { slug: string; provider: PublicProvider }) {
    const [ logoFailed, setLogoFailed ] = useState(false);
    return (
        <section className={styles.hero}>
            {provider.hasLogo && !logoFailed && (
                <img className={styles.logo} src={providerImageUrl(slug, "logo")} alt="" onError={() => setLogoFailed(true)} />
            )}
            <div className={styles.identity}>
                <ProviderAvatar slug={slug} provider={provider} className={styles.avatar} />
                <div>
                    <h1 className={styles.name}>{provider.displayName}</h1>
                    {provider.jobTitle && <p className={styles.jobTitle}>{provider.jobTitle}</p>}
                </div>
            </div>
            {provider.locations.length > 0 && (
                <ul className={styles.locations} aria-label="Dónde atiende">
                    {provider.locations.map((l) => (
                        <li key={l.id} className={styles.location}>
                            {l.isVirtual
                                ? <Video size={18} aria-hidden="true" className={styles.locationIcon} />
                                : <MapPin size={18} aria-hidden="true" className={styles.locationIcon} />}
                            <span>
                                <span className={styles.locationName}>{l.name}</span>
                                {locationDetail(l) && <span className={styles.address}>{locationDetail(l)}</span>}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function BookingDone({ slug, appointment, timezone, onBookAnother }: {
    slug: string; appointment: PortalAppointment; timezone: string; onBookAnother: () => void;
}) {
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => { heading.current?.focus(); }, []);
    return (
        <section className={`dash-card ${styles.flow} ${styles.done}`} aria-labelledby="booking-done">
            <h2 id="booking-done" ref={heading} tabIndex={-1} className={styles.doneTitle}>Tu cita quedó reservada</h2>
            <p className={styles.muted}>Te enviamos la confirmación a tu correo.</p>
            <PortalAppointmentCard appointment={appointment} timezone={timezone} inset />
            <p className={styles.note}>Horas en tu zona horaria: {timezoneName(timezone)}</p>
            <Link href={`/book/${encodeURIComponent(slug)}/appointments`} className={`btn-primary ${styles.doneAction}`}>Ver mis citas</Link>
            <button type="button" className={`btn-secondary ${styles.doneAction}`} onClick={onBookAnother}>Reservar otra cita</button>
        </section>
    );
}

function RequestSent({ slug, request, timezone, onBookAnother }: {
    slug: string; request: PortalPendingRequest; timezone: string; onBookAnother: () => void;
}) {
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => { heading.current?.focus(); }, []);
    return (
        <section className={`dash-card ${styles.flow} ${styles.done}`} aria-labelledby="request-sent" data-testid="request-sent">
            <h2 id="request-sent" ref={heading} tabIndex={-1} className={styles.doneTitle}>Solicitud enviada</h2>
            <p className={styles.muted}>
                Tu proveedor la revisará. Mientras tanto reservamos el horario para ti y te avisaremos por correo cuando sea confirmada.
            </p>
            <PortalRequestCard request={request} timezone={timezone} inset />
            <p className={styles.note}>Horas en tu zona horaria: {timezoneName(timezone)}</p>
            <Link href={`/book/${encodeURIComponent(slug)}/appointments`} className={`btn-primary ${styles.doneAction}`}>Ver mis citas</Link>
            <button type="button" className={`btn-secondary ${styles.doneAction}`} onClick={onBookAnother}>Hacer otra solicitud</button>
        </section>
    );
}

function ProfileSkeleton() {
    return (
        <section className={styles.hero} aria-busy="true" aria-label="Cargando">
            <div className={styles.identity}>
                <div className={`skeleton-bar ${styles.avatarSkeleton}`} />
                <div className={styles.skeletonLines}>
                    <div className="skeleton-bar" style={{ width: "70%", height: 24 }} />
                    <div className="skeleton-bar" style={{ width: "40%" }} />
                </div>
            </div>
        </section>
    );
}
