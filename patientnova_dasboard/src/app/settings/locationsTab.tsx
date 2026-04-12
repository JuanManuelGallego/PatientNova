import { useFetchLocations } from "@/src/api/useFetchLocations";
import { useUpdateLocation } from "@/src/api/useUpdateLocation";
import { SuccessBanner } from "@/src/components/Info/SuccessBanner";
import { LocationCard } from "@/src/components/LocationCard";
import { DeleteLocationModal } from "@/src/components/Modals/DeleteLocationModal";
import { LocationModal } from "@/src/components/Modals/LocationModal";
import { AppointmentLocation } from "@/src/types/Appointment";
import { useState } from "react";


export function LocationsTab() {
    const { locations, loading, fetchLocations } = useFetchLocations(true);
    const { updateLocation } = useUpdateLocation();

    const [ modalLocation, setModalLocation ] = useState<AppointmentLocation | null | undefined>(undefined);
    const [ deleteTarget, setDeleteTarget ] = useState<AppointmentLocation | null>(null);
    const [ success, setSuccess ] = useState(false);

    function handleSaved() {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        fetchLocations();
    }

    async function handleReactivate(loc: AppointmentLocation) {
        try {
            await updateLocation(loc.id, { isActive: true });
            fetchLocations();
        } catch { }
    }

    const activeLocations = locations.filter(l => l.isActive);
    const inactiveLocations = locations.filter(l => !l.isActive);

    const showModal = modalLocation !== undefined;

    return (
        <div style={{ maxWidth: 720 }}>
            {success && <SuccessBanner message="Ubicación guardada correctamente" />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--c-gray-700)" }}>Ubicaciones de citas</div>
                    <div style={{ fontSize: 12, color: "var(--c-gray-400)", marginTop: 2 }}>
                        Configura los lugares donde atiendes pacientes
                    </div>
                </div>
                <button className="btn-primary" onClick={() => setModalLocation(null)}>
                    + Nueva ubicación
                </button>
            </div>
            {loading ? (
                <div style={{ textAlign: "center", padding: 48, color: "var(--c-gray-400)" }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                    Cargando ubicaciones…
                </div>
            ) : activeLocations.length === 0 ? (
                <div className="dash-card">
                    <div className="dash-card__body" style={{ textAlign: "center", padding: "48px 24px" }}>
                        <div style={{
                            width: 72, height: 72, margin: "0 auto 16px",
                            background: "var(--c-gray-100)", borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 32,
                        }}>
                            📍
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--c-gray-700)", marginBottom: 4 }}>
                            Sin ubicaciones configuradas
                        </div>
                        <div style={{ fontSize: 13, color: "var(--c-gray-400)", marginBottom: 20 }}>
                            Agrega los lugares o salas donde atiendes a tus pacientes.
                        </div>
                        <button className="btn-primary" onClick={() => setModalLocation(null)}>
                            + Crear primera ubicación
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {activeLocations.map(loc => (
                        <LocationCard
                            key={loc.id}
                            loc={loc}
                            onEdit={() => setModalLocation(loc)}
                            onDelete={() => setDeleteTarget(loc)}
                        />
                    ))}

                    {inactiveLocations.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <div style={{
                                fontSize: 11, fontWeight: 700, color: "var(--c-gray-400)",
                                letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
                            }}>
                                Desactivadas ({inactiveLocations.length})
                            </div>
                            {inactiveLocations.map(loc => (
                                <LocationCard
                                    key={loc.id}
                                    loc={loc}
                                    onReactivate={() => handleReactivate(loc)}
                                    inactive
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
            {showModal && (
                <LocationModal
                    location={modalLocation}
                    onClose={() => setModalLocation(undefined)}
                    onSaved={handleSaved}
                />
            )}
            {deleteTarget && (
                <DeleteLocationModal
                    location={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onDeactivated={() => { setDeleteTarget(null); fetchLocations(); }}
                />
            )}
        </div>
    );
}
