import type { PublicProvider } from "@/src/types/PublicBooking";

type Provider = Pick<PublicProvider, "displayName" | "phone" | "whatsapp" | "legal">;

/**
 * The one source of the patient's authorization text. Any change here must bump `PRIVACY_POLICY_VERSION` on the
 * server and add the new text to `docs/legal/versions/`: consent rows store the version, not the wording.
 */
export function controllerName(provider: Provider): string {
    return provider.legal?.name ?? provider.displayName;
}

function directContact(provider: Provider): string {
    const ways = [ provider.phone, provider.whatsapp && provider.whatsapp !== provider.phone ? `WhatsApp ${provider.whatsapp}` : null ]
        .filter((way): way is string => !!way)
        .join(" o ");
    const hours = provider.legal?.contactHours;
    return [ ways, hours ].filter(Boolean).join(", ");
}

/** Behind "Ver detalles": who is responsible, Patient Nova's role, and the rights the policy details. */
export function controllerLine(provider: Provider): string {
    const contact = provider.legal?.privacyContact;
    return `Responsable del tratamiento: ${controllerName(provider)}${contact ? `, ${contact}` : ""}. Patient Nova opera este portal como su encargado. Puedes conocer, actualizar y rectificar tus datos o revocar esta autorización cuando quieras.`;
}

/**
 * Always visible under the checkbox (Decreto 1377, art. 6): which data is sensitive and that authorizing it is
 * optional. It never goes behind the details toggle.
 */
export const SENSITIVE_DATA_LINE = "Los datos de salud son datos sensibles: no estás obligado a autorizar su tratamiento.";

/** Behind "Ver detalles": the portal is optional, with the way to book without it. */
export function consentNotice(provider: Provider): string {
    const contact = directContact(provider);
    return `Este portal es voluntario; si prefieres no usarlo, puedes pedir y gestionar tu cita directamente con ${controllerName(provider)}${contact ? ` en ${contact}` : ""}, sin penalización.`;
}

/** The checkbox label; the caller appends the link to the privacy policy and the final full stop. */
export function consentLabel(provider: Provider): string {
    return `Autorizo expresamente a ${controllerName(provider)} a tratar mis datos de identificación y contacto y los datos de salud que revelen mis citas, para gestionar mis citas y solicitudes en este portal y enviarme sus avisos por los canales autorizados, según la`;
}

/** Help text of the contact field: the patient asks the clinic to use it for the confirmation link. */
export function accessNotice(provider: Provider): string {
    return `Al reservar pides a ${controllerName(provider)} que use este contacto para enviarte, mediante Patient Nova, el enlace de confirmación.`;
}
