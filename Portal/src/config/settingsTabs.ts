export enum SettingsTab {
    Profile = "Perfil",
    Security = "Seguridad",
    Locations = "Ubicaciones",
    AppointmentTypes = "Tipos de Cita",
    OnlineBooking = "Reserva en línea",
    Integrations = "Integraciones",
    Notifications = "Recordatorios",
}

export function settingsTabHref(tab: SettingsTab): string {
    return `/settings?${new URLSearchParams({ tab }).toString()}`;
}
