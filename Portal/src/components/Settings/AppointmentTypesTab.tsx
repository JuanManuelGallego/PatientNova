import { useFetchAppointmentTypes } from "@/src/api/appointment-types/useFetchAppointmentTypes";
import { AppointmentTypeCard } from "@/src/components/AppointmentTypeCard";
import { SuccessBanner } from "@/src/components/Info/SuccessBanner";
import { AppointmentTypeModal } from "@/src/components/Modals/AppointmentTypeModal";
import { Brain } from "lucide-react";
import { DeleteAppointmentTypeModal } from "@/src/components/Modals/DeleteAppointmentTypeModal";
import { AppointmentType } from "@/src/types/Appointment";
import { useState } from "react";
import { useDelayedLoading } from "@/src/hooks/useDelayedLoading";

export function AppointmentTypesTab() {
  const { appointmentTypes, loading, data, fetchAppointmentTypes } =
    useFetchAppointmentTypes();
  const showSpinner = useDelayedLoading(loading);

  const [modalType, setModalType] = useState<
    AppointmentType | null | undefined
  >(undefined);
  const [deleteTarget, setDeleteTarget] = useState<AppointmentType | null>(
    null,
  );
  const [success, setSuccess] = useState(false);

  function handleSaved() {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    fetchAppointmentTypes();
  }

  const showModal = modalType !== undefined;

  return (
    <div style={{ maxWidth: 720 }}>
      {success && (
        <SuccessBanner message="Tipo de cita guardado correctamente" />
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          paddingTop: 5,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--c-gray-700)",
            }}
          >
            Tipos de cita
          </div>
          <div
            style={{ fontSize: 12, color: "var(--c-gray-400)", marginTop: 2 }}
          >
            Configura los tipos de cita que ofreces
          </div>
        </div>
        <button className="btn-primary" onClick={() => setModalType(null)} data-testid="settings-new-type-button">
          Nuevo tipo
        </button>
      </div>

      {showSpinner ? (
        <div className="dash-card">
          <div
            className="dash-card__body"
            style={{ textAlign: "center", padding: "48px 24px", color: "var(--c-gray-400)" }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            Cargando tipos de cita…
          </div>
        </div>
      ) : data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {appointmentTypes.length === 0 ? (
            <div className="dash-card">
              <div
                className="dash-card__body"
                style={{ textAlign: "center", padding: "48px 24px" }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    margin: "0 auto 16px",
                    background: "var(--c-gray-100)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Brain size={32} />
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--c-gray-700)",
                    marginBottom: 4,
                  }}
                >
                  Sin tipos de cita configurados
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--c-gray-400)",
                    marginBottom: 20,
                  }}
                >
                  Agrega los tipos de cita que ofreces a tus pacientes.
                </div>
              </div>
            </div>
          ) :
          appointmentTypes.map((t) => (
            <AppointmentTypeCard
              key={t.id}
              type={t}
              onEdit={() => setModalType(t)}
              onDelete={() => setDeleteTarget(t)}
            />
          ))}
        </div>
      ) : null}
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
          onDelete={() => {
            setDeleteTarget(null);
            fetchAppointmentTypes();
          }}
        />
      )}
    </div>
  );
}
