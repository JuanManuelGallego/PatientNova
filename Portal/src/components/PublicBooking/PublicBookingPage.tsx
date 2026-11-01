"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { API_BASE } from "@/src/config/api";
import { useFetchPublicProvider } from "@/src/api/public-booking/useFetchPublicProvider";
import { useFetchPublicSlots } from "@/src/api/public-booking/useFetchPublicSlots";
import type { ApiClientError } from "@/src/api/base/apiClients";
import type { PublicProvider, PublicSlot } from "@/src/types/PublicBooking";
import { browserTimezone, fmtTime, todayFormattedString } from "@/src/utils/TimeUtils";
import { addCalendarDays, fmtCop, fmtDayChip, groupSlotsByDay, timezoneName, WEEK_DAYS, weekPage } from "@/src/utils/publicBooking";
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
    const [ slotChoice, setSlotChoice ] = useState<string | null>(null);
    const [ avatarFailed, setAvatarFailed ] = useState(false);

    const type = provider.types.find((t) => t.id === typeId) ?? provider.types[ 0 ];
    const page = weekPage(weekStart ?? today, today, provider.lastBookableDate);
    const { slots, loading, error, retry } = useFetchPublicSlots(slug, type?.id ?? null, page.from, page.to);
    const days = slots ? groupSlotsByDay(slots.slots, timezone) : [];
    const day = days.find((d) => d.date === dayChoice) ?? days[ 0 ];

    if (error?.status === 404) return <Unavailable />;

    const goToWeek = (start: string) => {
        setWeekStart(start);
        setDayChoice(null);
        setSlotChoice(null);
    };

    return (
        <>
            <header className={styles.header}>
                {provider.hasLogo
                    ? <img className={styles.logo} src={imageUrl(slug, "logo")} alt="" />
                    : <span />}
                <span className={styles.brand}>Reserva en línea</span>
            </header>

            <section className={`dash-card ${styles.card}`}>
                <div className={styles.provider}>
                    {provider.hasAvatar && !avatarFailed
                        ? <img className={styles.avatar} src={imageUrl(slug, "avatar")} alt="" onError={() => setAvatarFailed(true)} />
                        : <div className={styles.avatar} aria-hidden="true">{initials(provider.displayName)}</div>}
                    <div>
                        <h1 className={styles.name}>{provider.displayName}</h1>
                        {provider.jobTitle && <p className={styles.muted}>{provider.jobTitle}</p>}
                    </div>
                </div>
            </section>

            <section className={`dash-card ${styles.card}`} aria-labelledby="types-title">
                <h2 id="types-title" className={styles.sectionTitle}>Tipo de cita</h2>
                <div className={styles.options}>
                    {provider.types.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            className={styles.option}
                            aria-pressed={t.id === type?.id}
                            onClick={() => { setTypeId(t.id); setDayChoice(null); setSlotChoice(null); }}
                        >
                            {t.name}
                            <span className={styles.optionMeta}>
                                {t.durationMinutes} min{t.price !== null && ` · ${fmtCop(t.price)}`}
                            </span>
                            {t.description && <span className={styles.optionMeta}>{t.description}</span>}
                        </button>
                    ))}
                </div>
            </section>

            {provider.locations.length > 0 && (
                <section className={`dash-card ${styles.card}`} aria-labelledby="locations-title">
                    <h2 id="locations-title" className={styles.sectionTitle}>Dónde atiende</h2>
                    <ul className={styles.locations}>
                        {provider.locations.map((l) => (
                            <li key={l.id}><strong>{l.name}</strong>{l.address && ` · ${l.address}`}</li>
                        ))}
                    </ul>
                </section>
            )}

            <section className={`dash-card ${styles.card}`} aria-labelledby="slots-title">
                <h2 id="slots-title" className={styles.sectionTitle}>Horarios disponibles</h2>
                <div className={styles.weekNav}>
                    <button type="button" className="btn-secondary btn-secondary--sm" disabled={!page.hasPrevious}
                        onClick={() => goToWeek(addCalendarDays(page.from, -WEEK_DAYS))}>
                        Semana anterior
                    </button>
                    <span className={styles.weekLabel}>{fmtDayChip(page.from)} – {fmtDayChip(page.to)}</span>
                    <button type="button" className="btn-secondary btn-secondary--sm" disabled={!page.hasNext}
                        onClick={() => goToWeek(addCalendarDays(page.from, WEEK_DAYS))}>
                        Semana siguiente
                    </button>
                </div>

                {error ? <ErrorState error={error} onRetry={retry} inline />
                    : loading || !slots ? <SlotsSkeleton />
                    : !day ? (
                        <div className={styles.state}>
                            <p className={styles.muted}>No hay horarios disponibles esta semana.</p>
                            {page.hasNext && (
                                <button type="button" className="btn-secondary" onClick={() => goToWeek(addCalendarDays(page.from, WEEK_DAYS))}>
                                    Ver la semana siguiente
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className={styles.chips} role="group" aria-label="Días con horarios">
                                {days.map((d) => (
                                    <button key={d.date} type="button" className={styles.chip} aria-pressed={d.date === day.date}
                                        onClick={() => { setDayChoice(d.date); setSlotChoice(null); }}>
                                        {fmtDayChip(d.date)}
                                    </button>
                                ))}
                            </div>
                            <SlotGroup title="Mañana" slots={day.morning} timezone={timezone} selected={slotChoice} onSelect={setSlotChoice} />
                            <SlotGroup title="Tarde" slots={day.afternoon} timezone={timezone} selected={slotChoice} onSelect={setSlotChoice} />
                        </>
                    )}

                <p className={styles.note}>Horario de {timezoneName(timezone)}</p>
                {browserTimezone() !== timezone && (
                    <p className={styles.note}>Tu dispositivo está en otra zona horaria: las horas se muestran en la del profesional.</p>
                )}
            </section>

            <div className={styles.footer}>
                <button type="button" className="btn-primary" disabled>Reservar</button>
                <p className={styles.note}>Pronto podrás reservar en línea.</p>
            </div>
        </>
    );
}

function SlotGroup({ title, slots, timezone, selected, onSelect }: {
    title: string;
    slots: PublicSlot[];
    timezone: string;
    selected: string | null;
    onSelect: (startUtc: string) => void;
}) {
    if (slots.length === 0) return null;
    return (
        <div>
            <p className={styles.period}>{title}</p>
            <div className={styles.chips} role="group" aria-label={title}>
                {slots.map((s) => (
                    <button key={s.startUtc} type="button" className={styles.chip} aria-pressed={s.startUtc === selected}
                        onClick={() => onSelect(s.startUtc)}>
                        {fmtTime(s.startUtc, timezone)}
                    </button>
                ))}
            </div>
        </div>
    );
}

function Unavailable() {
    return (
        <section className={`dash-card ${styles.state}`}>
            <h1 className={styles.name}>Esta página de reservas no está disponible</h1>
            <p className={styles.muted}>Verifica el enlace o contacta directamente al profesional.</p>
        </section>
    );
}

function ErrorState({ error, onRetry, inline = false }: { error: ApiClientError; onRetry: () => void; inline?: boolean }) {
    return (
        <div className={inline ? styles.state : `dash-card ${styles.state}`} role="alert">
            <p className={styles.muted}>{error.message}</p>
            <button type="button" className="btn-secondary" onClick={onRetry}>Reintentar</button>
        </div>
    );
}

function ProfileSkeleton() {
    return (
        <section className={`dash-card ${styles.card}`} aria-busy="true" aria-label="Cargando">
            <div className={styles.provider}>
                <div className={`skeleton-bar ${styles.avatar}`} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="skeleton-bar" style={{ width: "60%" }} />
                    <div className="skeleton-bar" style={{ width: "40%" }} />
                </div>
            </div>
        </section>
    );
}

function SlotsSkeleton() {
    return (
        <div aria-busy="true" aria-label="Cargando horarios" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skeleton-bar" style={{ width: "80%", height: 32 }} />
            <div className="skeleton-bar" style={{ width: "60%", height: 32 }} />
        </div>
    );
}
