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

export function controllerLine(provider: Provider): string {
    const contact = provider.legal?.privacyContact;
    return `Responsable del tratamiento: ${controllerName(provider)}${contact ? `, ${contact}` : ""}. Patient Nova opera este portal por su cuenta.`;
}

export function consentNotice(provider: Provider): string {
    const contact = directContact(provider);
    return `Tus citas pueden revelar información sobre tu salud. No estás obligado a autorizar el tratamiento de datos sensibles. Este portal es voluntario. Si prefieres no usarlo, puedes solicitar y gestionar tu cita directamente con ${controllerName(provider)}${contact ? ` en ${contact}` : ""}, sin penalización por rechazar este tratamiento digital. No escribas aquí diagnósticos ni información clínica adicional.`;
}

export function consentLabel(provider: Provider): string {
    return `Autorizo expresamente a ${controllerName(provider)}, mediante Patient Nova como su encargado, a recoger y utilizar mis datos de identificación y contacto y los datos de salud que revele la gestión de mis citas, para mostrarme y gestionar mis citas y solicitudes en este portal y enviar los avisos de su gestión por los canales que tenga autorizados. Conozco mis derechos y el procedimiento de revocación descritos en la`;
}

export function accessNotice(provider: Provider): string {
    return `Al reservar solicitas a ${controllerName(provider)} que utilice este contacto para enviarte el enlace de confirmación de tu cita mediante Patient Nova. No incluyas datos de salud en este paso.`;
}
