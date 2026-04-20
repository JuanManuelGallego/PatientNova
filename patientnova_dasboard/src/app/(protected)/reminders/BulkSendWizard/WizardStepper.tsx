"use client";

import { memo } from "react";

export const WizardStepper = memo(function WizardStepper({ step }: { step: number }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {[ "Canal", "Pacientes", "Mensaje", "Resultado" ].map((s, i) => (
                <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 70 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: step > i + 1 ? "var(--c-brand)" : step === i + 1 ? "var(--c-brand-accent)" : "var(--c-gray-200)",
                            color: step >= i + 1 ? "var(--c-white)" : "var(--c-gray-400)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 13, fontWeight: 700,
                        }}>
                            {step > i + 1 ? "✓" : i + 1}
                        </div>
                        <span style={{ fontSize: 11, color: step === i + 1 ? "var(--c-brand)" : "var(--c-gray-400)", fontWeight: step === i + 1 ? 600 : 400 }}>
                            {s}
                        </span>
                    </div>
                    {i < 3 && (
                        <div style={{
                            flex: 1, height: 2,
                            background: step > i + 1 ? "var(--c-brand)" : "var(--c-gray-200)",
                            marginBottom: 18, transition: "background 0.3s",
                        }} />
                    )}
                </div>
            ))}
        </div>
    );
});
