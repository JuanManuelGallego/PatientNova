"use client";

import { memo } from "react";
import { Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import { getAvatarColor, getInitials } from "@/src/utils/AvatarHelper";
import { StepPatientsProps } from "./types";

export const StepPatients = memo(function StepPatients({ eligible, channel, selected, toggleAll, toggleOne, onBack, onNext }: StepPatientsProps) {
    return (
        <div className="table-card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <div className="wizard-section-title" style={{ marginBottom: 2 }}>Seleccionar pacientes</div>
                    <div className="patient-preview__detail">{selected.size} de {eligible.length} seleccionados</div>
                </div>
                <button onClick={toggleAll} className="btn-secondary" style={{ padding: "7px 16px", fontSize: 13 }}>
                    {selected.size > 0 && selected.size === eligible.length ? "Deseleccionar todos" : "Seleccionar todos"}
                </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {eligible.length === 0 && (
                    <div style={{ textAlign: "center", padding: 32, color: "var(--c-gray-400)", fontSize: 14 }}>
                        Ningún paciente activo tiene número de {CHANNEL_CFG[ channel ].label}.
                    </div>
                )}
                {eligible.map(p => (
                    <div key={p.id} onClick={() => toggleOne(p.id)}
                        className={`patient-select-item${selected.has(p.id) ? " patient-select-item--selected" : ""}`}
                    >
                        <div className={`checkbox-box${selected.has(p.id) ? " checkbox-box--checked" : ""}`}>
                            {selected.has(p.id) && "✓"}
                        </div>
                        <div className="avatar avatar--sm" style={{ background: getAvatarColor(p.id) }}>
                            {getInitials(p.name, p.lastName)}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div className="patient-preview__name">{p.name} {p.lastName}</div>
                            <div className="patient-preview__detail">
                                {channel === Channel.WHATSAPP ? p.whatsappNumber : channel === Channel.SMS ? p.smsNumber : p.email}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button onClick={onBack} className="btn-secondary">Atrás</button>
                <button onClick={onNext} disabled={selected.size === 0} className="btn-primary">
                    Continuar → ({selected.size})
                </button>
            </div>
        </div>
    );
});
