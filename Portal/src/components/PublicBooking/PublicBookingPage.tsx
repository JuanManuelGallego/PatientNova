"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { API_BASE } from "@/src/config/api";
import { useFetchPublicProvider } from "@/src/api/public-booking/useFetchPublicProvider";
import { useFetchPublicSlots } from "@/src/api/public-booking/useFetchPublicSlots";
import type { ApiClientError } from "@/src/api/base/apiClients";
import type { PublicProvider, PublicSlot } from "@/src/types/PublicBooking";
import { browserTimezone, fmtTime, todayFormattedString } from "@/src/utils/TimeUtils";
import {
    addCalendarDays, calendarDaysBetween, fmtCop, fmtDayParts, fmtWeekRange, groupSlotsByDay, timezoneName, WEEK_DAYS, weekPage,
} from "@/src/utils/publicBooking";
import styles from "./PublicBooking.module.css";

export function PublicBookingPage({ slug }: { slug: string }) {
    const { provider, loading, error, retry } = useFetchPublicProvider(slug);

    let body: React.ReactNode;
    if (error?.status === 404) body = <Unavailable />;
    else if (error) body = <ErrorState error={error} onRetry={retry} />;
    else if (loading || !provider) body = <ProfileSkeleton />;
    else body = <BookingView slug={slug} provider={provider} />;

    return (
        <main className={styles.page}>
            <div className={styles.container}>{body}</div>
        </main>
    );
}

function imageUrl(slug: string, kind: "avatar" | "logo") {
    return `${API_BASE}/public/providers/${encodeURIComponent(slug)}/${kind}`;
}

function initials(name: string): string {
    const words = name.split(/\s+/).filter((w) => w && !w.endsWith("."));
    return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
}

function BookingView({ slug, provider }: { slug: string; provider: PublicProvider }) {
    const { timezone } = provider;
    const today = todayFormattedString(timezone);
    const [ typeId, setTypeId ] = useState<string | null>(null);
    const [ weekStart, setWeekStart ] = useState<string | null>(null);
    const [ dayChoice, setDayChoice ] = useState<string | null>(null);

    const type = provider.types.find((t) => t.id === typeId) ?? provider.types[ 0 ];
    const page = weekPage(weekStart ?? today, today, provider.lastBookableDate);
    const { slots, loading, error, retry } = useFetchPublicSlots(slug, type?.id ?? null, page.from, page.to);
    const slotDays = new Map((slots ? groupSlotsByDay(slots.slots, timezone) : []).map((d) => [ d.date, d ]));
    const weekDays = calendarDaysBetween(page.from, page.to);
    const openDays = weekDays.filter((d) => slotDays.has(d));
    const day = slotDays.get(dayChoice && openDays.includes(dayChoice) ? dayChoice : openDays[ 0 ] ?? "");

    if (error?.status === 404) return <Unavailable />;

    const goToWeek = (start: string) => {
        setWeekStart(start);
        setDayChoice(null);
    };
    const nextWeek = () => goToWeek(addCalendarDays(page.from, WEEK_DAYS));

    return (
        <>
            <ProviderHero slug={slug} provider={provider} />

            <section className={`dash-card ${styles.flow}`} aria-label="Horarios disponibles">
                <p className={styles.notice}>Pronto podrás reservar aquí. Por ahora puedes ver los horarios disponibles.</p>

                <Step number={1} title="Tipo de cita">
                    <div className={styles.options}>
                        {provider.types.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                className={styles.option}
                                aria-pressed={t.id === type?.id}
                                onClick={() => { setTypeId(t.id); setDayChoice(null); }}
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
                                        <button key={date} type="button" className={styles.day} disabled={!open}
                                            aria-pressed={open ? date === day?.date : undefined}
                                            aria-label={open ? full : `${full}, sin horarios`}
                                            onClick={() => setDayChoice(date)}>
                                            <span className={styles.dayWeekday}>{weekday}</span>
                                            <span className={styles.dayNumber}>{dayNumber}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                </Step>

                <Step number={3} title="Hora">
                    {browserTimezone() !== timezone && (
                        <p className={styles.zoneWarning}>
                            <AlertTriangle size={16} aria-hidden="true" />
                            Tu dispositivo está en otra zona horaria. Las horas están en la del profesional.
                        </p>
                    )}
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
                                <TimeGroup title="Mañana" slots={day.morning} timezone={timezone} />
                                <TimeGroup title="Tarde" slots={day.afternoon} timezone={timezone} />
                            </>
                        )}
                    <p className={styles.note}>Horario de {timezoneName(timezone)}</p>
                </Step>
            </section>
        </>
    );
}

function ProviderHero({ slug, provider }: { slug: string; provider: PublicProvider }) {
    const [ avatarFailed, setAvatarFailed ] = useState(false);
    const [ logoFailed, setLogoFailed ] = useState(false);
    return (
        <section className={styles.hero}>
            {provider.hasLogo && !logoFailed && (
                <img className={styles.logo} src={imageUrl(slug, "logo")} alt="" onError={() => setLogoFailed(true)} />
            )}
            <div className={styles.identity}>
                {provider.hasAvatar && !avatarFailed
                    ? <img className={styles.avatar} src={imageUrl(slug, "avatar")} alt="" onError={() => setAvatarFailed(true)} />
                    : <div className={styles.avatar} aria-hidden="true">{initials(provider.displayName)}</div>}
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

function TimeGroup({ title, slots, timezone }: { title: string; slots: PublicSlot[]; timezone: string }) {
    if (slots.length === 0) return null;
    return (
        <div>
            <p className={styles.period}>{title}</p>
            <ul className={styles.times} aria-label={title}>
                {slots.map((s) => <li key={s.startUtc} className={styles.time}>{fmtTime(s.startUtc, timezone)}</li>)}
            </ul>
        </div>
    );
}

function Unavailable() {
    return (
        <section className={`dash-card ${styles.state}`}>
            <h1 className={styles.stateTitle}>Esta página de reservas no está disponible</h1>
            <p className={styles.muted}>Verifica el enlace o contacta directamente al profesional.</p>
        </section>
    );
}

function ErrorState({ error, onRetry, inline = false }: { error: ApiClientError; onRetry: () => void; inline?: boolean }) {
    return (
        <div className={inline ? styles.empty : `dash-card ${styles.state}`} role="alert">
            <p className={styles.muted}>{error.message}</p>
            <button type="button" className="btn-secondary" onClick={onRetry}>Reintentar</button>
        </div>
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
