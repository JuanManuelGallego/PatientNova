"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarOff, CalendarPlus, CircleCheck, Clock, MapPin, MessageCircle, Phone, Video } from "lucide-react";
import { useFetchPublicProvider } from "@/src/api/public-booking/useFetchPublicProvider";
import type { PublicProvider } from "@/src/types/PublicBooking";
import type { PortalAppointment, PortalBookingOutcome, PortalPendingRequest } from "@/src/types/PortalBooking";
import { browserTimezone } from "@/src/utils/TimeUtils";
import { downloadAppointmentIcs } from "@/src/utils/appointmentCalendar";
import { APPROVAL_FOLLOW_UP, fmtCop, fmtPhone, locationDetail, mapUrl, timezoneName, whatsappUrl } from "@/src/utils/publicBooking";
import styles from "./PublicBooking.module.css";
import { ErrorState, PublicPageShell, Unavailable } from "./PublicStates";
import { ProviderAvatar, providerImageUrl } from "./ProviderAvatar";
import { BookingProgress, StateIcon, TrustStrip } from "./PublicChrome";
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

    return <PublicPageShell appointmentsHref={error ? undefined : appointmentsPath(slug)}>{body}</PublicPageShell>;
}

const appointmentsPath = (slug: string) => `/book/${encodeURIComponent(slug)}/appointments`;
const EXTERNAL_LINK = { target: "_blank", rel: "noopener noreferrer" } as const;
const LOCATION_STEP = "Elige el lugar";

function BookingPaused({ slug, provider }: { slug: string; provider: PublicProvider }) {
    return (
        <>
            <ProviderHero slug={slug} provider={provider} />
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

function BookingView({ slug, provider }: { slug: string; provider: PublicProvider }) {
    const timezone = browserTimezone();
    const [ typeId, setTypeId ] = useState<string | null>(null);
    const [ locationId, setLocationId ] = useState<string | null>(null);
    const [ booked, setBooked ] = useState<PortalBookingOutcome | null>(null);

    const type = provider.types.find((t) => t.id === typeId) ?? provider.types[ 0 ];
    const picker = useSlotPicker(slug, provider, { typeId: type?.id ?? null }, timezone);
    const { slot, notice, error } = picker;
    const pickedStart = slot?.startUtc;
    const choosesLocation = provider.locations.length > 1;
    const location = choosesLocation ? provider.locations.find((l) => l.id === locationId) : provider.locations[ 0 ];
    const locationReady = location !== undefined;
    const locationStep = useRef<HTMLDivElement>(null);
    const confirmStep = useRef<HTMLDivElement>(null);
    const slotNoticeRef = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        if (pickedStart) reveal(locationReady ? confirmStep.current : locationStep.current);
    }, [ pickedStart, locationReady ]);

    useEffect(() => {
        if (notice) slotNoticeRef.current?.focus();
    }, [ notice ]);

    if (error?.status === 404) return <Unavailable />;

    const bookAnother = () => {
        setBooked(null);
        setLocationId(null);
        picker.pick(null);
        picker.retry();
    };

    if (booked) {
        return (
            <>
                <ProviderHero slug={slug} provider={provider} compact />
                {"request" in booked
                    ? <RequestSent slug={slug} providerName={provider.displayName} request={booked.request} timezone={timezone} onBookAnother={bookAnother} />
                    : <BookingDone slug={slug} providerName={provider.displayName} appointment={booked.appointment} timezone={timezone} onBookAnother={bookAnother} />}
            </>
        );
    }

    const confirmTitle = provider.approvalRequired ? "Envía tu solicitud" : "Confirma tu cita";
    const typeChosen = typeId !== null || provider.types.length === 1;
    const steps = [ "Tipo de cita", "Día", "Hora", ...(choosesLocation ? [ LOCATION_STEP ] : []), confirmTitle ];
    const currentStep = slot ? (location ? steps.length : 4) : picker.dayChosen ? 3 : typeChosen ? 2 : 1;

    return (
        <>
            <ProviderHero slug={slug} provider={provider}>
                <TrustStrip />
            </ProviderHero>

            <section className={`dash-card ${styles.flow}`} aria-label="Horarios disponibles">
                <BookingProgress steps={steps} current={currentStep} />
                {provider.approvalRequired && (
                    <p className={styles.approvalNotice} data-testid="approval-notice">
                        {provider.displayName} confirma cada cita antes de reservarla. Eliges un horario, lo guardamos
                        para ti y te avisamos cuando la confirme.
                    </p>
                )}
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

                {slot && choosesLocation && (
                    <Step number={4} title={LOCATION_STEP} stepRef={locationStep}>
                        <div className={styles.options}>
                            {provider.locations.map((l) => (
                                <button key={l.id} type="button" className={styles.option} aria-pressed={l.id === location?.id}
                                    onClick={() => setLocationId(l.id)}>
                                    <span className={styles.optionName}>{l.name}</span>
                                    {locationDetail(l) && <span className={styles.optionMeta}>{locationDetail(l)}</span>}
                                </button>
                            ))}
                        </div>
                    </Step>
                )}

                {slot && type && location && (
                    <Step number={steps.length} title={confirmTitle} stepRef={confirmStep}>
                        <BookingForm key={slot.startUtc} slug={slug} provider={provider} type={type} location={location} slot={slot}
                            timezone={timezone} onBooked={setBooked} onSlotTaken={picker.slotTaken} />
                    </Step>
                )}
            </section>
        </>
    );
}

function ProviderHero({ slug, provider, compact = false, children }: {
    slug: string; provider: PublicProvider; compact?: boolean; children?: React.ReactNode;
}) {
    const [ logoFailed, setLogoFailed ] = useState(false);
    const showLocations = provider.locations.length > 0 && !compact;
    const showContact = Boolean(provider.phone || provider.whatsapp);
    return (
        <section className={styles.hero}>
            <div className={styles.card} data-compact={compact || undefined}>
                <ProviderAvatar slug={slug} provider={provider} className={styles.portrait} />
                <div className={styles.intro}>
                    {provider.hasLogo && !logoFailed && (
                        <img className={styles.logo} src={providerImageUrl(slug, "logo")} alt="" onError={() => setLogoFailed(true)} />
                    )}
                    <h1 className={styles.name}>{provider.displayName}</h1>
                    {provider.jobTitle && <p className={styles.role}>{provider.jobTitle}</p>}
                    {provider.specialty && <p className={styles.specialty}>{provider.specialty}</p>}
                </div>
                {provider.bio && !compact && (
                    <div className={styles.about}><ProviderBio bio={provider.bio} /></div>
                )}
                {(showLocations || showContact) && (
                    <div className={styles.band}>
                        {showLocations && (
                            <ul className={styles.locations} aria-label="Dónde atiende">
                                {provider.locations.map((l) => (
                                    <li key={l.id} className={styles.location}>
                                        {l.isVirtual
                                            ? <Video size={18} aria-hidden="true" className={styles.locationIcon} />
                                            : <MapPin size={18} aria-hidden="true" className={styles.locationIcon} />}
                                        <span>
                                            <span className={styles.locationName}>{l.name}</span>
                                            {locationDetail(l) && <span className={styles.address}>{locationDetail(l)}</span>}
                                            {!l.isVirtual && l.address && (
                                                <a href={mapUrl(l.address)} {...EXTERNAL_LINK} className={styles.mapLink}>Ver en el mapa</a>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <ProviderContact provider={provider} />
                    </div>
                )}
            </div>
            {children}
        </section>
    );
}

function ProviderBio({ bio }: { bio: string }) {
    const text = useRef<HTMLParagraphElement>(null);
    const [ expanded, setExpanded ] = useState(false);
    const [ cutOff, setCutOff ] = useState(false);

    useEffect(() => {
        const el = text.current;
        if (!el || expanded || typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(() => setCutOff(el.scrollHeight > el.clientHeight));
        observer.observe(el);
        return () => observer.disconnect();
    }, [ expanded ]);

    return (
        <div>
            <p ref={text} className={expanded ? styles.bio : `${styles.bio} ${styles.bioClamped}`}>{bio}</p>
            {(cutOff || expanded) && (
                <button type="button" className={styles.textButton} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                    {expanded ? "Ver menos" : "Ver más"}
                </button>
            )}
        </div>
    );
}

function ProviderContact({ provider: { phone, whatsapp } }: { provider: PublicProvider }) {
    if (!phone && !whatsapp) return null;
    return (
        <ul className={styles.contact} aria-label="Contacto">
            {phone && (
                <li>
                    <a href={`tel:${phone}`} className={styles.contactLink}>
                        <Phone size={16} aria-hidden="true" />{fmtPhone(phone)}
                    </a>
                </li>
            )}
            {whatsapp && (
                <li>
                    <a href={whatsappUrl(whatsapp)} {...EXTERNAL_LINK} className={styles.contactLink}>
                        <MessageCircle size={16} aria-hidden="true" />WhatsApp
                    </a>
                </li>
            )}
        </ul>
    );
}

function BookingDone({ slug, providerName, appointment, timezone, onBookAnother }: {
    slug: string; providerName: string; appointment: PortalAppointment; timezone: string; onBookAnother: () => void;
}) {
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => { heading.current?.focus(); }, []);
    return (
        <section className={`dash-card ${styles.flow} ${styles.done}`} aria-labelledby="booking-done">
            <StateIcon icon={CircleCheck} />
            <h2 id="booking-done" ref={heading} tabIndex={-1} className={styles.doneTitle}>Tu cita quedó reservada</h2>
            <p className={styles.muted}>Te enviamos la confirmación.</p>
            <PortalAppointmentCard appointment={appointment} timezone={timezone} inset />
            <p className={styles.note}>Horas en tu zona horaria: {timezoneName(timezone)}</p>
            <Link href={`/book/${encodeURIComponent(slug)}/appointments`} className={`btn-primary ${styles.doneAction}`}>Ver mis citas</Link>
            <button type="button" className={`btn-secondary ${styles.doneAction} ${styles.withIcon}`}
                onClick={() => downloadAppointmentIcs(appointment, providerName, timezone)}>
                <CalendarPlus size={18} aria-hidden="true" />Añadir al calendario
            </button>
            <button type="button" className={`btn-secondary ${styles.doneAction}`} onClick={onBookAnother}>Reservar otra cita</button>
        </section>
    );
}

function RequestSent({ slug, providerName, request, timezone, onBookAnother }: {
    slug: string; providerName: string; request: PortalPendingRequest; timezone: string; onBookAnother: () => void;
}) {
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => { heading.current?.focus(); }, []);
    return (
        <section className={`dash-card ${styles.flow} ${styles.done}`} aria-labelledby="request-sent" data-testid="request-sent">
            <StateIcon icon={Clock} />
            <h2 id="request-sent" ref={heading} tabIndex={-1} className={styles.doneTitle}>Solicitud enviada</h2>
            <p className={styles.muted}>
                {providerName} la revisará. Mientras tanto guardamos el horario para ti. {APPROVAL_FOLLOW_UP}
            </p>
            <PortalRequestCard request={request} timezone={timezone} inset />
            <p className={styles.note}>Horas en tu zona horaria: {timezoneName(timezone)}</p>
            <Link href={`/book/${encodeURIComponent(slug)}/appointments`} className={`btn-primary ${styles.doneAction}`}>Ver mis citas</Link>
            <button type="button" className={`btn-secondary ${styles.doneAction}`} onClick={onBookAnother}>Enviar otra solicitud</button>
        </section>
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
