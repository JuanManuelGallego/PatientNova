"use client";

import { useState } from "react";
import { useHistoryOverlay } from "@/src/hooks/useHistoryOverlay";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import type { PortalBookingOutcome } from "@/src/types/PortalBooking";
import type { PublicProvider } from "@/src/types/PublicBooking";
import { browserTimezone } from "@/src/utils/TimeUtils";
import { appointmentsPath } from "@/src/utils/publicBooking";
import { BookingResult } from "./BookingResult";
import { NeedStep, needTitle } from "./NeedStep";
import { PatientSteps } from "./PatientSteps";
import { ProviderHeader } from "./ProviderHeader";
import { ProviderPanel, ProviderProfileSheet } from "./ProviderProfile";
import { Unavailable } from "./PublicStates";
import { SlotChooser } from "./SlotChooser";
import { BookingSummary, StepScreen } from "./StepScreen";
import { applicableSteps, useBookingFlow } from "./useBookingFlow";
import { useSlotChooser } from "./useSlotChooser";
import styles from "./BookingFlow.module.css";

const DESKTOP = "(min-width: 960px)";

export function BookingFlow({ slug, provider }: { slug: string; provider: PublicProvider }) {
    const timezone = browserTimezone();
    const [ typeId, setTypeId ] = useState<string | null>(null);
    const [ locationId, setLocationId ] = useState<string | null>(null);
    const [ booked, setBooked ] = useState<PortalBookingOutcome | null>(null);
    const [ verified, setVerified ] = useState(false);
    const [ patientStepsReached, setPatientStepsReached ] = useState(false);
    const profile = useHistoryOverlay("profile");
    const desktop = useMediaQuery(DESKTOP);

    const { types, locations } = provider;
    const type = types.length === 1 ? types[ 0 ] : types.find((t) => t.id === typeId);
    const location = locations.length === 1 ? locations[ 0 ] : locations.find((l) => l.id === locationId);
    const needDone = type !== undefined && location !== undefined;

    const picker = useSlotChooser(slug, provider, { typeId: type?.id ?? null }, timezone);
    const { slot } = picker;
    const steps = applicableSteps({ typeCount: types.length, locationCount: locations.length, verified });
    const flow = useBookingFlow(steps, { needDone, hasSlot: slot !== undefined, verified });

    // History can reach these steps too, not only Continuar.
    if ((flow.step === "verify" || flow.step === "details") && !patientStepsReached) setPatientStepsReached(true);

    if (picker.error?.status === 404) return <Unavailable />;

    const summary = <BookingSummary type={type} location={location} slot={slot} timezone={timezone} />;
    const onBack = flow.isFirst || booked ? undefined : flow.back;
    const screen = { steps, step: flow.step, moved: flow.moved, onBack: desktop ? onBack : undefined };

    const bookAnother = () => {
        setBooked(null);
        setTypeId(null);
        setLocationId(null);
        setVerified(false);
        setPatientStepsReached(false);
        picker.reload();
        flow.go(steps[ 0 ] ?? "time");
    };

    const leaveTimes = () => {
        setPatientStepsReached(true);
        flow.go(verified ? "details" : "verify");
    };

    const header = (
        <div className={styles.aside}>
            {desktop ? <ProviderPanel slug={slug} provider={provider} appointmentsHref={appointmentsPath(slug)} /> : (
                <ProviderHeader
                    slug={slug}
                    provider={provider}
                    compact={!flow.isFirst || booked !== null}
                    appointmentsHref={appointmentsPath(slug)}
                    onOpenProfile={profile.show}
                    onBack={onBack}
                />
            )}
        </div>
    );
    const profileSheet = profile.open && (
        <ProviderProfileSheet slug={slug} provider={provider}
            closeLabel={typeId || locationId || slot ? "Volver a la reserva" : "Reservar una cita"} onClose={profile.hide} />
    );

    if (booked) {
        return (
            <div className={styles.layout}>
                {header}
                <BookingResult slug={slug} provider={provider} outcome={booked} location={location} timezone={timezone} onBookAnother={bookAnother} />
                {profileSheet}
            </div>
        );
    }

    return (
        <div className={styles.layout}>
            {header}
            {flow.step === "need" && (
                <StepScreen key="need" {...screen} title={needTitle(provider)} dock={(
                    <>
                        {summary}
                        <button type="button" className={`btn-primary ${styles.dockAction}`} disabled={!needDone} onClick={() => flow.go("time")}>Ver horarios</button>
                    </>
                )}>
                    <ApprovalNotice provider={provider} first={flow.isFirst} />
                    <NeedStep provider={provider} typeId={type?.id} locationId={location?.id} onType={setTypeId} onLocation={setLocationId} />
                </StepScreen>
            )}
            {flow.step === "time" && (
                <StepScreen key="time" {...screen} title="¿Cuándo te queda bien?" dock={(
                    <>
                        {summary}
                        <button type="button" className={`btn-primary ${styles.dockAction}`} disabled={!slot} onClick={leaveTimes}>Continuar</button>
                    </>
                )}>
                    <ApprovalNotice provider={provider} first={flow.isFirst} />
                    <SlotChooser picker={picker} />
                </StepScreen>
            )}
            {patientStepsReached && (
                <PatientSteps
                    slug={slug}
                    provider={provider}
                    type={type}
                    location={location}
                    slot={slot}
                    timezone={timezone}
                    {...screen}
                    summary={summary}
                    onVerified={setVerified}
                    onSessionLost={() => flow.go("verify")}
                    onBooked={setBooked}
                    onSlotTaken={(message) => { picker.slotTaken(message); flow.go("time"); }}
                />
            )}
            {profileSheet}
        </div>
    );
}

function ApprovalNotice({ provider, first }: { provider: PublicProvider; first: boolean }) {
    if (!provider.approvalRequired || !first) return null;
    return (
        <p className={styles.quiet} data-testid="approval-notice">
            {provider.displayName} confirma cada cita antes de reservarla. Eliges un horario, lo guardamos para ti y te avisamos cuando la confirme.
        </p>
    );
}
