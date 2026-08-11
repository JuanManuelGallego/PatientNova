"use client";

import { memo, useMemo } from "react";
import { ReminderMode } from "@/src/types/Reminder";
import {
  TWILIO_CONFIG,
  BULK_TEMPLATE_KEYS,
  TwilioTemplate,
  TemplateVariable,
} from "@/src/utils/twilioConfig";
import { CustomSelect } from "@/src/components/CustomSelect";
import { RequiredField } from "@/src/components/Info/Required";
import { STATUS_ICONS } from "@/src/config/icons";
import { StepTemplateProps } from "./types";

function buildPreview(
  template: TwilioTemplate,
  sharedVariables: Record<string, string>,
): string {
  let text = template.template;
  for (const v of template.variables) {
    const value =
      v.autoFill === "patientName"
        ? `{{Paciente}}`
        : sharedVariables[v.key] || `{{${v.key}}}`;
    text = text.replaceAll(`{{${v.key}}}`, value || `{{${v.key}}}`);
  }
  return text;
}

export const StepTemplate = memo(function StepTemplate({
  selectedTemplate,
  onTemplateChange,
  sharedVariables,
  onSharedVariablesChange,
  recipientCount,
  sendMode,
  sending,
  onBack,
  onSend,
}: StepTemplateProps) {
  const template = TWILIO_CONFIG[selectedTemplate];

  const sharedVars: TemplateVariable[] = useMemo(() => {
    if (!template) return [];
    return template.variables.filter(
      (v) => v.autoFill !== "patientName" && v.autoFill !== "userId",
    );
  }, [template]);

  const preview = useMemo(() => {
    if (!template) return "";
    return buildPreview(template, sharedVariables);
  }, [template, sharedVariables]);

  const noTemplates = BULK_TEMPLATE_KEYS.length === 0;

  const canSend = useMemo(() => {
    if (!selectedTemplate || noTemplates) return false;
    return sharedVars.every((v) => (sharedVariables[v.key] || "").trim() !== "");
  }, [selectedTemplate, noTemplates, sharedVars, sharedVariables]);

  return (
    <div
      className="table-card"
      style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}
    >
      <div className="wizard-section-title">Seleccionar plantilla</div>

      {noTemplates ? (
        <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <STATUS_ICONS.warning size={14} /> No hay plantillas disponibles para envío masivo en este momento.
        </div>
      ) : (
        <>
          <label className="form-label">
            <RequiredField label="Plantilla" />
            <CustomSelect
              value={selectedTemplate}
              placeholder="Seleccionar plantilla…"
              options={BULK_TEMPLATE_KEYS.map((key) => ({
                value: key,
                label: TWILIO_CONFIG[key].label,
              }))}
              onChange={onTemplateChange}
            />
          </label>

          {template && (
            <>
              {sharedVars.length > 0 && (
                <div>
                  <div className="channel-section-label">
                    Variables compartidas
                  </div>
                  <div className="form-grid-2">
                    {sharedVars.map((v) => (
                      <label key={v.key} className="form-label">
                        {v.label}
                        <input
                          className="form-input"
                          type="text"
                          value={sharedVariables[v.key] || ""}
                          onChange={(e) =>
                            onSharedVariablesChange({
                              ...sharedVariables,
                              [v.key]: e.target.value,
                            })
                          }
                          placeholder={v.label}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label className="form-label">
                Vista previa del mensaje
                <textarea
                  disabled
                  className="form-input form-input--textarea"
                  style={{ minHeight: 100 }}
                  value={preview}
                  readOnly
                />
                <span className="form-input-hint">
                  {preview.length} / 1600 caracteres
                </span>
              </label>
            </>
          )}
        </>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button onClick={onBack} className="btn-secondary" data-testid="bulk-send-back-button">
          Atrás
        </button>
        <button
          onClick={onSend}
          disabled={!canSend || sending}
          className="btn-primary btn-hero"
          data-testid="bulk-send-submit-button"
        >
          {sending ? (
            <>
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "var(--c-white)",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                  display: "inline-block",
                }}
              />
              Enviando…
            </>
          ) : (
            `${sendMode === ReminderMode.IMMEDIATE ? "Enviar" : "Programar"} a ${recipientCount} pacientes`
          )}
        </button>
      </div>
    </div>
  );
});
