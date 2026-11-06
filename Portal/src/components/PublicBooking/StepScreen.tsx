"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import type { PublicAppointmentType, PublicLocation, PublicSlot } from "@/src/types/PublicBooking";
import { fmtCop, fmtShortDayTime } from "@/src/utils/publicBooking";
import { BookingProgress } from "./PublicChrome";
import type { BookingStep } from "./useBookingFlow";
import styles from "./BookingFlow.module.css";

const STEP_LABELS: Record<BookingStep, string> = {
    need: "Tu cita",
    time: "Horario",
    verify: "Confirma que eres tú",
    details: "Tus datos",
};

interface StepScreenProps {
    steps: BookingStep[];
    step: BookingStep;
    title: string;
    /** False on the page's first screen, where focus and scroll stay where the browser left them. */
    moved: boolean;
    dock: ReactNode;
    /** Desktop only: phones keep Atrás in the provider header. */
    onBack?: (() => void) | undefined;
    children: ReactNode;
}

/** One decision per screen. Mount it with `key={step}`: each step starts at the top with focus on its title. */
export function StepScreen({ steps, step, title, moved, dock, onBack, children }: StepScreenProps) {
    const id = useId();
    const main = useRef<HTMLElement>(null);
    const heading = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        if (!moved) return;
        window.scrollTo(0, 0);
        // A notice inside the screen may have taken focus already, and it matters more than the title.
        if (!main.current?.contains(document.activeElement)) heading.current?.focus({ preventScroll: true });
    }, [ moved ]);

    return (
        <div className={styles.stepCard}>
            <section ref={main} className={styles.main} aria-labelledby={id}>
                <div className={styles.stepBar}>
                    <BookingProgress steps={steps.map((s) => STEP_LABELS[ s ])} current={steps.indexOf(step) + 1} />
                    {onBack && (
                        <button type="button" className={styles.back} onClick={onBack}>
                            <ChevronLeft size={18} aria-hidden="true" />Atrás
                        </button>
                    )}
                </div>
                <h2 id={id} ref={heading} tabIndex={-1} className={styles.title}>{title}</h2>
                {children}
            </section>
            <div className={styles.dock}>{dock}</div>
        </div>
    );
}

interface BookingSummaryProps {
    type: PublicAppointmentType | undefined;
    location: PublicLocation | undefined;
    slot: PublicSlot | undefined;
    timezone: string;
}

/** What the patient has chosen so far, always in view. */
export function BookingSummary({ type, location, slot, timezone }: BookingSummaryProps) {
    const detail = [ type?.name, location?.name, type && type.price !== null ? fmtCop(type.price) : null ].filter(Boolean).join(" · ");
    if (!slot && !detail) return null;
    return (
        <div className={styles.summary} data-testid="booking-summary">
            {slot && <p className={styles.summaryTime}>{fmtShortDayTime(slot.startUtc, timezone)}</p>}
            {detail && <p className={styles.summaryDetail}>{detail}</p>}
        </div>
    );
}
