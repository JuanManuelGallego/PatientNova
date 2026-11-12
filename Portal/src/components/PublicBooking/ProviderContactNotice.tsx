import type { PublicProvider } from "@/src/types/PublicBooking";
import { fmtPhone, whatsappUrl } from "@/src/utils/publicBooking";
import styles from "./BookingFlow.module.css";

type Provider = Pick<PublicProvider, "displayName" | "phone" | "whatsapp">;

export function ProviderContactNotice({ provider }: { provider: Provider }) {
    const { phone, whatsapp } = provider;
    if (!phone && !whatsapp) return null;
    return (
        <div className={styles.contactNotice} data-testid="provider-contact">
            <p className={styles.quiet}>Para cancelar o cambiar tu cita, comunícate directamente con {provider.displayName}</p>
            <p className={styles.contactLinks}>
                {phone && <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>Llamar al {fmtPhone(phone)}</a>}
                {whatsapp && <a href={whatsappUrl(whatsapp)} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a>}
            </p>
        </div>
    );
}
