export const SITE_URL = "https://www.patientnova.net";

export const SUPPORT_EMAIL = "support@patientnova.net";

export const CONTACT_HREF = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Quiero probar Patient Nova")}&body=${
    encodeURIComponent("Hola, me interesa Patient Nova para mi consulta.\n\nMi nombre:\nMi especialidad:\nCiudad:\n")
}`;

export const SUPPORT_WHATSAPP = "+573044873415";

export const WHATSAPP_CONTACT_HREF = `https://wa.me/${SUPPORT_WHATSAPP.slice(1)}?text=${
    encodeURIComponent("Hola, quiero probar Patient Nova para mi consulta.")
}`;

export const MARKETING_PAGES = [
    { path: "/reserva-en-linea", label: "Reserva en línea" },
    { path: "/recordatorios", label: "Recordatorios" },
    { path: "/historia-clinica", label: "Historia clínica" },
    { path: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
] as const;

export const INDEXABLE_PATHS = [
    "/",
    ...MARKETING_PAGES.map((p) => p.path),
    "/privacy-policy",
    "/terms-of-service",
    "/patient-terms",
] as const;
