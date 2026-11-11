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

export function needTitle(provider: PublicProvider) {
    return provider.types.length > 1 ? "¿Qué necesitas?" : "Tu cita";
}

export function NeedStep({ provider, typeId, locationId, onType, onLocation }: NeedStepProps) {
    const typeChoice = provider.types.length > 1;
    const placeChoice = provider.locations.length > 1;
    return (
        <>
            {!typeChoice && <h3 className={styles.subtitle}>Tipo de cita</h3>}
            <div className={styles.options} role="group" aria-label="Tipo de cita">
                {provider.types.map((t) => (
                    <button key={t.id} type="button" className={styles.option} aria-pressed={t.id === typeId} onClick={() => onType(t.id)}>
                        <span className={styles.optionHead}>
                            <span className={styles.optionName}>{t.name}</span>
                            {t.price !== null && <span className={styles.optionPrice}>{fmtCop(t.price)}</span>}
                        </span>
                        <span className={styles.optionMeta}>{t.durationMinutes} minutos</span>
                        {t.description && <span className={styles.optionMeta}>{t.description}</span>}
                    </button>
                ))}
            </div>
            <h3 className={styles.subtitle}>{placeChoice ? "¿Dónde prefieres atenderte?" : "Lugar de atención"}</h3>
            <div className={styles.places} role="group" aria-label="Lugar" data-stacked={provider.locations.length !== 2 || undefined}>
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
