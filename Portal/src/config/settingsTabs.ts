/** Settings tabs; the value is both the visible label and the `?tab=` key. */
export enum SettingsTab {
    Profile = "Perfil",
    Security = "Seguridad",
    Locations = "Ubicaciones",
    AppointmentTypes = "Tipos de Cita",
    OnlineBooking = "Reserva en línea",
    Integrations = "Integraciones",
    Notifications = "Recordatorios",
}

/** The one place that knows how a Settings tab is addressed. */
export function settingsTabHref(tab: SettingsTab): string {
    return `/settings?${new URLSearchParams({ tab }).toString()}`;
}
