import { useFetchLocations } from "@/src/api/locations/useFetchLocations";
import { SaveStatusIndicator } from "@/src/components/Info/SaveStatusIndicator";
import { LocationCard } from "@/src/components/LocationCard";
import { DeleteLocationModal } from "@/src/components/Modals/DeleteLocationModal";
import { MapPin } from "lucide-react";
import { LocationModal } from "@/src/components/Modals/LocationModal";
import { AppointmentLocation } from "@/src/types/Appointment";
import { useState } from "react";
import { useSavedFlash } from "@/src/hooks/useSavedFlash";
import { SettingsList } from "./SettingsList";

export function LocationsTab() {
  const { data, loading, error, fetchLocations } = useFetchLocations();
  const saved = useSavedFlash();

  const [ modalLocation, setModalLocation ] = useState<AppointmentLocation | null | undefined>(undefined);
  const [ deleteTarget, setDeleteTarget ] = useState<AppointmentLocation | null>(null);

  function handleSaved() {
    saved.flash();
    fetchLocations();
  }

  return (
    <div className="settings-stack">
      <SettingsList<AppointmentLocation>
        title="Ubicaciones de citas"
        description="Configura los lugares donde atiendes pacientes"
        newLabel="Nueva ubicación"
        newTestId="settings-new-location-button"
        onNew={() => setModalLocation(null)}
        items={data ?? undefined}
        loading={loading}
        error={error}
        onRetry={() => fetchLocations()}
        empty={{ icon: MapPin, title: "Sin ubicaciones configuradas", sub: "Agrega los lugares o salas donde atiendes a tus pacientes." }}
        status={<SaveStatusIndicator saving={false} status={saved.active ? "saved" : "idle"} testId="locations-save-state" />}
        renderItem={(loc) => (
          <LocationCard
            key={loc.id}
            loc={loc}
            onEdit={() => setModalLocation(loc)}
            onDelete={() => setDeleteTarget(loc)}
          />
        )}
      />
      {modalLocation !== undefined && (
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
          onDelete={() => {
            setDeleteTarget(null);
            fetchLocations();
          }}
        />
      )}
    </div>
  );
}
