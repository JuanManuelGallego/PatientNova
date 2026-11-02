"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { useFetchPublicProvider } from "@/src/api/public-booking/useFetchPublicProvider";
import { useFetchPublicSlots } from "@/src/api/public-booking/useFetchPublicSlots";
import type { PublicProvider, PublicSlot } from "@/src/types/PublicBooking";
import type { PortalAppointment } from "@/src/types/PortalBooking";
import { browserTimezone, fmtTime, todayFormattedString } from "@/src/utils/TimeUtils";
import {
    addCalendarDays, calendarDaysBetween, fmtCop, fmtDayParts, fmtWeekRange, groupSlotsByDay, lastBookableDateIn, slotQueryRange,
    timezoneName, WEEK_DAYS, weekPage,
} from "@/src/utils/publicBooking";
import styles from "./PublicBooking.module.css";
import { ErrorState, PublicPageShell, Unavailable } from "./PublicStates";
import { ProviderAvatar, providerImageUrl } from "./ProviderAvatar";
import { BookingForm } from "./BookingForm";
import { PortalAppointmentCard } from "./PortalAppointmentCard";

export function PublicBookingPage({ slug }: { slug: string }) {
    const { provider, loading, error, retry } = useFetchPublicProvider(slug);

    let body: React.ReactNode;
    if (error?.status === 404) body = <Unavailable />;
    else if (error) body = <ErrorState error={error} onRetry={retry} />;
    else if (loading || !provider) body = <ProfileSkeleton />;
    else body = <BookingView slug={slug} provider={provider} />;

    return <PublicPageShell>{body}</PublicPageShell>;
}

function BookingView({ slug, provider }: { slug: string; provider: PublicProvider }) {
    const timezone = browserTimezone();
    const today = todayFormattedString(timezone);
    const [ typeId, setTypeId ] = useState<string | null>(null);
    const [ weekStart, setWeekStart ] = useState<string | null>(null);
    const [ dayChoice, setDayChoice ] = useState<string | null>(null);
    const [ startUtc, setStartUtc ] = useState<string | null>(null);
    const [ slotNotice, setSlotNotice ] = useState<string | null>(null);
    const [ booked, setBooked ] = useState<PortalAppointment | null>(null);

    const type = provider.types.find((t) => t.id === typeId) ?? provider.types[ 0 ];
    const lastDate = lastBookableDateIn(timezone, provider.lastBookableDate, provider.timezone);
    const page = weekPage(weekStart ?? today, today, lastDate);
    const query = slotQueryRange(page.from, page.to);
    const { slots, loading, error, retry } = useFetchPublicSlots(slug, type?.id ?? null, query.from, query.to);
    const slotDays = new Map((slots ? groupSlotsByDay(slots.slots, timezone) : []).map((d) => [ d.date, d ]));
    const weekDays = calendarDaysBetween(page.from, page.to);
    const openDays = weekDays.filter((d) => slotDays.has(d));
    const day = slotDays.get(dayChoice && openDays.includes(dayChoice) ? dayChoice : openDays[ 0 ] ?? "");
    const slot = day && [ ...day.morning, ...day.afternoon ].find((s) => s.startUtc === startUtc);

    if (error?.status === 404) return <Unavailable />;

    const pickSlot = (next: string | null) => {
        setStartUtc(next);
        setSlotNotice(null);
    };
    const goToWeek = (start: string) => {
        setWeekStart(start);
        setDayChoice(null);
        pickSlot(null);
    };
    const nextWeek = () => goToWeek(addCalendarDays(page.from, WEEK_DAYS));
    const onSlotTaken = (message: string) => {
        setStartUtc(null);
        setSlotNotice(message);
        retry();
    };
    const bookAnother = () => {
        setBooked(null);
        pickSlot(null);
        retry();
    };

    const nav = (
        <nav className={styles.topNav} aria-label="Cuenta">
            <Link href={`/book/${encodeURIComponent(slug)}/appointments`} className={styles.topLink}>Mis citas</Link>
        </nav>
    );

    if (booked) {
        return (
            <>
                {nav}
                <ProviderHero slug={slug} provider={provider} />
                <BookingDone slug={slug} appointment={booked} timezone={timezone} onBookAnother={bookAnother} />
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
                                onClick={() => { setTypeId(t.id); setDayChoice(null); pickSlot(null); }}
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

                <Step
                    number={2}
                    title="Día"
                    aside={
                        <div className={styles.weekNav}>
                            <button type="button" className={styles.iconButton} aria-label="Semana anterior" disabled={!page.hasPrevious}
                                onClick={() => goToWeek(addCalendarDays(page.from, -WEEK_DAYS))}>
                                <ChevronLeft size={20} aria-hidden="true" />
                            </button>
                            <span className={styles.weekLabel}>{fmtWeekRange(page.from, page.to)}</span>
                            <button type="button" className={styles.iconButton} aria-label="Semana siguiente" disabled={!page.hasNext}
                                onClick={nextWeek}>
                                <ChevronRight size={20} aria-hidden="true" />
                            </button>
                        </div>
                    }
                >
                    {error ? <ErrorState error={error} onRetry={retry} inline />
                        : loading || !slots ? <DaysSkeleton />
                        : (
                            <div className={styles.days} role="group" aria-label="Días de la semana">
                                {weekDays.map((date) => {
                                    const { weekday, dayNumber, full } = fmtDayParts(date);
                                    const open = openDays.includes(date);
                                    return (
                                        <button key={date} type="button" className={styles.day}
                                            aria-disabled={open ? undefined : true}
                                            aria-pressed={open ? date === day?.date : undefined}
                                            aria-label={open ? full : `${full}, sin horarios`}
                                            data-tooltip={open ? undefined : "Sin horarios disponibles"}
                                            onClick={() => { if (open) { setDayChoice(date); pickSlot(null); } }}>
                                            <span className={styles.dayWeekday}>{weekday}</span>
                                            <span className={styles.dayNumber}>{dayNumber}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                </Step>

                <Step number={3} title="Hora">
                    {slotNotice && <p className={styles.notice} role="alert">{slotNotice}</p>}
                    {error ? null
                        : loading || !slots ? <TimesSkeleton />
                        : !day ? (
                            <div className={styles.empty}>
                                <p className={styles.muted}>No hay horarios disponibles esta semana.</p>
                                {page.hasNext && (
                                    <button type="button" className="btn-secondary" onClick={nextWeek}>Ver la semana siguiente</button>
                                )}
                            </div>
                        ) : (
                            <>
                                <TimeGroup title="Mañana" slots={day.morning} timezone={timezone} selected={slot?.startUtc} onSelect={pickSlot} />
                                <TimeGroup title="Tarde" slots={day.afternoon} timezone={timezone} selected={slot?.startUtc} onSelect={pickSlot} />
                            </>
                        )}
                    <p className={styles.note}>Horas en tu zona horaria: {timezoneName(timezone)}</p>
                </Step>

                {slot && type && (
                    <Step number={4} title="Confirma tu cita">
                        <BookingForm key={slot.startUtc} slug={slug} provider={provider} type={type} slot={slot} timezone={timezone}
                            onBooked={setBooked} onSlotTaken={onSlotTaken} />
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
                            <MapPin size={18} aria-hidden="true" className={styles.locationIcon} />
                            <span>
                                <span className={styles.locationName}>{l.name}</span>
                                {l.address && <span className={styles.address}>{l.address}</span>}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function Step({ number, title, aside, children }: { number: number; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
    const id = `step-${number}`;
    return (
        <div className={styles.step} role="group" aria-labelledby={id}>
            <div className={styles.stepHead}>
                <h2 id={id} className={styles.stepTitle}>
                    <span className={styles.stepNumber} aria-hidden="true">{number}</span>
                    {title}
                </h2>
                {aside}
            </div>
            {children}
        </div>
    );
}

interface TimeGroupProps {
    title: string;
    slots: PublicSlot[];
    timezone: string;
    selected: string | undefined;
    onSelect: (startUtc: string) => void;
}

function TimeGroup({ title, slots, timezone, selected, onSelect }: TimeGroupProps) {
    if (slots.length === 0) return null;
    return (
        <div>
            <p className={styles.period}>{title}</p>
            <ul className={styles.times} aria-label={title}>
                {slots.map((s) => (
                    <li key={s.startUtc}>
                        <button type="button" className={styles.time} aria-pressed={s.startUtc === selected} onClick={() => onSelect(s.startUtc)}>
                            {fmtTime(s.startUtc, timezone)}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
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
            <PortalAppointmentCard appointment={appointment} timezone={timezone} />
            <Link href={`/book/${encodeURIComponent(slug)}/appointments`} className={`btn-primary ${styles.doneAction}`}>Ver mis citas</Link>
            <button type="button" className={`btn-secondary ${styles.doneAction}`} onClick={onBookAnother}>Reservar otra cita</button>
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

function DaysSkeleton() {
    return (
        <div className={styles.days} aria-busy="true" aria-label="Cargando días">
            {Array.from({ length: WEEK_DAYS }, (_, i) => <div key={i} className={`skeleton-bar ${styles.daySkeleton}`} />)}
        </div>
    );
}

function TimesSkeleton() {
    return (
        <div className={styles.times} aria-busy="true" aria-label="Cargando horarios">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className={`skeleton-bar ${styles.timeSkeleton}`} />)}
        </div>
    );
}
