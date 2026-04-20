"use client";

import { memo, useMemo } from "react";
import { CHANNEL_CFG } from "@/src/types/Reminder";
import { StepResultsProps } from "./types";

export const StepResults = memo(function StepResults({ results, onReset }: StepResultsProps) {
    const stats = useMemo(() => {
        let ok = 0, error = 0, skipped = 0;
        for (const r of results) {
            if (r.status === "ok") ok++;
            else if (r.status === "error") error++;
            else skipped++;
        }
        return { ok, error, skipped };
    }, [ results ]);

    return (
        <div className="table-card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {[
                    { label: "Enviados", value: stats.ok, color: "var(--c-success)", bg: "var(--c-success-bg)" },
                    { label: "Fallidos", value: stats.error, color: "var(--c-error)", bg: "var(--c-error-bg)" },
                    { label: "Omitidos", value: stats.skipped, color: "var(--c-warning)", bg: "var(--c-warning-bg)" },
                ].map(({ label, value, color, bg }) => (
                    <div key={label} style={{ background: bg, borderRadius: "var(--r-xl)", padding: "16px 20px", textAlign: "center" }}>
                        <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
                        <div style={{ fontSize: 12, color, fontWeight: 500 }}>{label}</div>
                    </div>
                ))}
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <table className="table-full">
                    <thead>
                        <tr style={{ background: "var(--c-gray-50)" }}>
                            {[ "Paciente", "Canal", "Resultado", "Detalle" ].map(h => (
                                <th key={h} className="th" style={{ fontSize: 11 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((r) => (
                            <tr key={r.patientId} style={{ borderBottom: "1px solid var(--c-gray-100)" }}>
                                <td className="td"><span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-gray-900)" }}>{r.name}</span></td>
                                <td className="td">{CHANNEL_CFG[ r.channel ].icon}</td>
                                <td className="td">
                                    <span className="pill" style={{
                                        background: r.status === "ok" ? "var(--c-success-bg)" : r.status === "error" ? "var(--c-error-bg)" : "var(--c-warning-bg)",
                                        color: r.status === "ok" ? "var(--c-success)" : r.status === "error" ? "var(--c-error)" : "var(--c-warning)",
                                    }}>
                                        {r.status === "ok" ? "✓ Enviado" : r.status === "error" ? "✗ Error" : "— Omitido"}
                                    </span>
                                </td>
                                <td className="td td--subtle">{r.reason ?? "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={onReset} className="btn-primary">Nuevo envío masivo</button>
            </div>
        </div>
    );
});
