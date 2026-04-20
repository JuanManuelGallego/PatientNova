"use client";

import { memo, useMemo } from "react";
import { ReminderMode, Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import { DateTimePicker } from "@/src/components/DateTimePicker";
import { StepChannelProps } from "./types";

export const StepChannel = memo(function StepChannel({ patients, channel, setChannel, setSelected, sendMode, setMode, sentAt, setSentAt, onNext }: StepChannelProps) {
    const channelCounts = useMemo(() => {
        const counts: Record<Channel, number> = { [ Channel.WHATSAPP ]: 0, [ Channel.SMS ]: 0, [ Channel.EMAIL ]: 0 };
        for (const p of patients) {
            if (p.status !== "ACTIVE") continue;
            if (p.whatsappNumber) counts[ Channel.WHATSAPP ]++;
            if (p.smsNumber) counts[ Channel.SMS ]++;
            if (p.email) counts[ Channel.EMAIL ]++;
        }
        return counts;
    }, [ patients ]);

    return (
        <div className="table-card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
                <div className="wizard-section-title">Canal de notificación</div>
                <div className="form-grid-2">
                    {Object.values(Channel).map(c => (
                        <button key={c} onClick={() => { setChannel(c); setSelected(new Set()); }}
                            className={`selection-card${channel === c ? " selection-card--active" : ""}`}
                            style={{ padding: "16px 20px" }}
                        >
                            <span style={{ fontSize: 28 }}>{CHANNEL_CFG[ c ].icon}</span>
                            <div>
                                <div className="patient-preview__name">{CHANNEL_CFG[ c ].label}</div>
                                <div className="patient-preview__detail">{channelCounts[ c ]} pacientes disponibles</div>
                            </div>
                            {channel === c && <span style={{ marginLeft: "auto", color: "var(--c-brand)", fontSize: 18 }}>&#10003;</span>}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <div className="wizard-section-title">Tipo de envío</div>
                <div className="form-grid-2">
                    {([
                        { k: ReminderMode.IMMEDIATE, icon: "⚡", title: "Enviar ahora", sub: "Envío inmediato a todos" },
                        { k: ReminderMode.SCHEDULED, icon: "🗓️", title: "Programar envío", sub: "Elegir fecha y hora" },
                    ] as const).map(opt => (
                        <button key={opt.k} onClick={() => setMode(opt.k)}
                            className={`selection-card selection-card--column${sendMode === opt.k ? " selection-card--active" : ""}`}
                            style={{ padding: "14px 18px" }}
                        >
                            <span style={{ fontSize: 22 }}>{opt.icon}</span>
                            <span className="patient-preview__name">{opt.title}</span>
                            <span className="patient-preview__detail">{opt.sub}</span>
                        </button>
                    ))}
                </div>
            </div>
            {sendMode === ReminderMode.SCHEDULED && (
                <label className="form-label">
                    Fecha y hora de envío
                    <DateTimePicker date={sentAt} onChanged={setSentAt} showTime isFuture />
                </label>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={onNext} disabled={sendMode === ReminderMode.SCHEDULED && !sentAt} className="btn-primary">
                    Continuar →
                </button>
            </div>
        </div>
    );
});
