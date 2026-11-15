import { useFetchAppointmentTypes } from "@/src/api/appointment-types/useFetchAppointmentTypes";
import { AppointmentTypeCard } from "@/src/components/AppointmentTypeCard";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { AppointmentTypeModal } from "@/src/components/Modals/AppointmentTypeModal";
import { Brain } from "lucide-react";
import { DeleteAppointmentTypeModal } from "@/src/components/Modals/DeleteAppointmentTypeModal";
import { AppointmentType } from "@/src/types/Appointment";
import { useState } from "react";
import { useSavedFlash } from "@/src/hooks/useSavedFlash";
import { SettingsList } from "./SettingsList";
import { useSettingsAttention } from "@/src/providers/SettingsAttentionContext";

export function AppointmentTypesTab({ onReady }: { onReady?: () => void } = {}) {
  const { data, loading, error, fetchAppointmentTypes } = useFetchAppointmentTypes();
  const saved = useSavedFlash();
  const { refresh: refreshAttention } = useSettingsAttention();

  const [ modalType, setModalType ] = useState<AppointmentType | null | undefined>(undefined);
  const [ deleteTarget, setDeleteTarget ] = useState<AppointmentType | null>(null);

  function handleSaved() {
    saved.flash();
    fetchAppointmentTypes();
    refreshAttention();
  }

  return (
    <div className="settings-stack">
      <SettingsList<AppointmentType>
        id="appointment-types"
        title="Tipos de cita"
        description="Configura los tipos de cita que ofreces"
        newLabel="Nuevo tipo"
        newTestId="settings-new-type-button"
        onNew={() => setModalType(null)}
        items={data ?? undefined}
        loading={loading}
        error={error}
        onRetry={() => fetchAppointmentTypes()}
        empty={{ icon: Brain, title: "Sin tipos de cita configurados", sub: "Agrega los tipos de cita que ofreces a tus pacientes." }}
        onReady={onReady}
        status={<SaveStatusIndicator saving={false} status={saved.active ? "saved" : "idle"} testId="appointment-types-save-state" />}
        renderItem={(t) => (
          <AppointmentTypeCard
            key={t.id}
            type={t}
            onEdit={() => setModalType(t)}
            onDelete={() => setDeleteTarget(t)}
          />
        )}
      />
      {modalType !== undefined && (
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
            refreshAttention();
          }}
        />
      )}
    </div>
  );
}
