import { useFetchAppointmentTypes } from "@/src/api/useFetchAppointmentTypes";
import { useUpdateAppointmentType } from "@/src/api/useUpdateAppointmentType";
import { AppointmentTypeCard } from "@/src/components/AppointmentTypeCard";
import { SuccessBanner } from "@/src/components/Info/SuccessBanner";
import { AppointmentTypeModal } from "@/src/components/Modals/AppointmentTypeModal";
import { DeleteAppointmentTypeModal } from "@/src/components/Modals/DeleteAppointmentTypeModal";
import { AppointmentType } from "@/src/types/Appointment";
import { useState } from "react";

export function AppointmentTypesTab() {
    const { appointmentTypes, loading, fetchAppointmentTypes } = useFetchAppointmentTypes();
    const { updateAppointmentType } = useUpdateAppointmentType();

    const [ modalType, setModalType ] = useState<AppointmentType | null | undefined>(undefined);
    const [ deleteTarget, setDeleteTarget ] = useState<AppointmentType | null>(null);
    const [ success, setSuccess ] = useState(false);

    function handleSaved() {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        fetchAppointmentTypes();
    }

    async function handleReactivate(t: AppointmentType) {
        try {
            await updateAppointmentType(t.id, { isActive: true });
            fetchAppointmentTypes();
        } catch { }
    }

    const activeTypes = appointmentTypes.filter(t => t.isActive);
    const inactiveTypes = appointmentTypes.filter(t => !t.isActive);
    const showModal = modalType !== undefined;

    return (
        <div style={{ maxWidth: 720 }}>
            {success && <SuccessBanner message="Tipo de cita guardado correctamente" />}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--c-gray-700)" }}>Tipos de cita</div>
                    <div style={{ fontSize: 12, color: "var(--c-gray-400)", marginTop: 2 }}>
                        Configura los tipos de cita que ofreces
                    </div>
                </div>
                <button className="btn-primary" onClick={() => setModalType(null)}>
                    + Nuevo tipo
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: "center", padding: 48, color: "var(--c-gray-400)" }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                    Cargando tipos de cita…
                </div>
            ) : activeTypes.length === 0 ? (
                <div className="dash-card">
                    <div className="dash-card__body" style={{ textAlign: "center", padding: "48px 24px" }}>
                        <div style={{
                            width: 72, height: 72, margin: "0 auto 16px",
                            background: "var(--c-gray-100)", borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 32,
                        }}>
                            🧠
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--c-gray-700)", marginBottom: 4 }}>
                            Sin tipos de cita configurados
                        </div>
                        <div style={{ fontSize: 13, color: "var(--c-gray-400)", marginBottom: 20 }}>
                            Agrega los tipos de cita que ofreces a tus pacientes.
                        </div>
                        <button className="btn-primary" onClick={() => setModalType(null)}>
                            + Crear primer tipo
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {activeTypes.map(t => (
                        <AppointmentTypeCard
                            key={t.id}
                            type={t}
                            onEdit={() => setModalType(t)}
                            onDelete={() => setDeleteTarget(t)}
                        />
                    ))}

                    {inactiveTypes.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <div style={{
                                fontSize: 11, fontWeight: 700, color: "var(--c-gray-400)",
                                letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
                            }}>
                                Desactivados ({inactiveTypes.length})
                            </div>
                            {inactiveTypes.map(t => (
                                <AppointmentTypeCard
                                    key={t.id}
                                    type={t}
                                    onReactivate={() => handleReactivate(t)}
                                    inactive
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showModal && (
                <AppointmentTypeModal
                    appointmentType={modalType}
                    onClose={() => setModalType(undefined)}
                    onSaved={handleSaved}
                />
            )}

            {deleteTarget && (
                <DeleteAppointmentTypeModal
                    appointmentType={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onDeactivated={() => { setDeleteTarget(null); fetchAppointmentTypes(); }}
                />
            )}
        </div>
    );
}
