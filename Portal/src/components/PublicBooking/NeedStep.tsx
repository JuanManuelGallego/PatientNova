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

/** Type and place together: slots depend on the type only, so the place can come first. */
export function NeedStep({ provider, typeId, locationId, onType, onLocation }: NeedStepProps) {
    return (
        <>
            {provider.types.length > 1 && (
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
            )}
            {provider.locations.length > 1 && (
                <>
                    <h3 className={styles.subtitle}>¿Dónde prefieres atenderte?</h3>
                    <div className={styles.places} role="group" aria-label="Lugar" data-many={provider.locations.length > 2 || undefined}>
                        {provider.locations.map((l) => (
                            <button key={l.id} type="button" className={styles.option} aria-pressed={l.id === locationId} onClick={() => onLocation(l.id)}>
                                <span className={styles.optionName}>{l.name}</span>
                                {locationDetail(l) && <span className={styles.optionMeta}>{locationDetail(l)}</span>}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </>
    );
}
