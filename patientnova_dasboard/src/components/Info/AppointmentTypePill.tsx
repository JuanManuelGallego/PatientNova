import { AppointmentType } from "@/src/types/Appointment";


export function AppointmentTypePill({ appointmentType }: { appointmentType: AppointmentType }) {
    return (
        <span className="pill" style={{
            background: appointmentType.color + "15",
            color: appointmentType.color || "var(--c-gray-700)",
        }}>
            {appointmentType.name}
        </span>
    );

}