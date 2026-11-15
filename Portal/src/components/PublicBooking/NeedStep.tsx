import { useEffect, useRef, useState } from "react";
import type { PublicProvider } from "@/src/types/PublicBooking";
import { fmtCop, locationDetail } from "@/src/utils/publicBooking";
import styles from "./BookingFlow.module.css";

interface NeedStepProps {
    provider: PublicProvider;
    typeId: string | undefined;
    locationId: string | undefined;
    onType: (id: string) => void;
    onLocation: (id: string) => void;
}

const GAP = 16;

export function needTitle(provider: PublicProvider) {
    return provider.types.length > 1 ? "¿Qué necesitas?" : "Tu cita";
}

/**
 * Brings the place question into view once a type is picked, so a long list of types does not hide it
 * below the dock. Nothing moves when it is already visible, and its heading never leaves the top.
 */
function revealPlaces(heading: HTMLElement, group: HTMLElement) {
    const dock = group.closest(`.${styles.stepCard}`)?.querySelector<HTMLElement>(`.${styles.dock}`);
    const visibleBottom = dock ? dock.getBoundingClientRect().top : window.innerHeight;
    const below = group.getBoundingClientRect().bottom + GAP - visibleBottom;
    if (below <= 0) return;
    const top = Math.min(below, heading.getBoundingClientRect().top - GAP);
    if (top <= 0) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({ top, behavior: reduce ? "auto" : "smooth" });
}

export function NeedStep({ provider, typeId, locationId, onType, onLocation }: NeedStepProps) {
    const typeChoice = provider.types.length > 1;
    const placeChoice = provider.locations.length > 1;
    const placeHeading = useRef<HTMLHeadingElement>(null);
    const places = useRef<HTMLDivElement>(null);
    const [ reveal, setReveal ] = useState(0);

    // After the commit, so the dock already shows the chosen type at its new height.
    useEffect(() => {
        if (reveal && placeHeading.current && places.current) revealPlaces(placeHeading.current, places.current);
    }, [ reveal ]);

    const chooseType = (id: string) => {
        onType(id);
        if (placeChoice && !locationId) setReveal((n) => n + 1);
    };

    return (
        <>
            {!typeChoice && <h3 className={styles.subtitle}>Tipo de cita</h3>}
            <div className={styles.options} role="group" aria-label="Tipo de cita">
                {provider.types.map((t) => (
                    <button key={t.id} type="button" className={styles.option} aria-pressed={t.id === typeId} onClick={() => chooseType(t.id)}>
                        <span className={styles.optionHead}>
                            <span className={styles.optionName}>{t.name}</span>
                            {t.price !== null && <span className={styles.optionPrice}>{fmtCop(t.price)}</span>}
                        </span>
                        <span className={styles.optionMeta}>{t.durationMinutes} minutos</span>
                        {t.description && <span className={styles.optionMeta}>{t.description}</span>}
                    </button>
                ))}
            </div>
            <h3 ref={placeHeading} className={styles.subtitle}>{placeChoice ? "¿Dónde prefieres atenderte?" : "Lugar de atención"}</h3>
            <div ref={places} className={styles.places} role="group" aria-label="Lugar" data-stacked={provider.locations.length !== 2 || undefined}>
                {provider.locations.map((l) => (
                    <button key={l.id} type="button" className={styles.option} aria-pressed={l.id === locationId} onClick={() => onLocation(l.id)}>
                        <span className={styles.optionName}>{l.name}</span>
                        {locationDetail(l) && <span className={styles.optionMeta}>{locationDetail(l)}</span>}
                    </button>
                ))}
            </div>
        </>
    );
}
