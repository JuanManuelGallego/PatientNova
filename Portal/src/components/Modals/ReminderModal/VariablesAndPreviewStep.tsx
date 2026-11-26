import { ReminderForm } from "@/src/types/Reminder";
import { TwilioTemplate } from "@/src/utils/twilioConfig";
import { RequiredField } from "@/src/components/Info/Required";
import { STATUS_ICONS } from "@/src/config/icons";

export function VariablesAndPreviewStep({
  form,
  setForm,
  selectedTemplate,
  preview,
  missingConsentType,
}: {
  form: ReminderForm;
  setForm: React.Dispatch<React.SetStateAction<ReminderForm>>;
  selectedTemplate: TwilioTemplate;
  preview: string;
  /** The patient's type, when the template links a consent form and that type has none (the send stays blocked). */
  missingConsentType?: string | null;
}) {
  const userEditableVariables = selectedTemplate.variables.filter(
    (v) => v.autoFill !== "consentDocumentId",
  );

  return (
    <div className="form-stack">
      {missingConsentType != null && (
        <div className="info-banner" style={{ fontSize: 13 }} data-testid="reminder-consent-missing">
          <STATUS_ICONS.info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            {`El tipo «${missingConsentType}» no tiene formulario de consentimiento. Súbelo en Configuración › Tipos de paciente para poder enviar esta plantilla.`}
          </span>
        </div>
      )}
      <label className="form-label">
        <RequiredField label="Vista previa del mensaje" />
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
      {userEditableVariables.length > 0 && (
        <div>
          <div className="channel-section-label">
            Variables de la plantilla
          </div>
          <div className="form-grid-2">
            {userEditableVariables.map((v) => (
              <label key={v.key} className="form-label">
                {v.label}
                <input
                  className="form-input"
                  type="text"
                  value={form.contentVariables[v.key] || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      contentVariables: {
                        ...f.contentVariables,
                        [v.key]: e.target.value,
                      },
                    }))
                  }
                  placeholder={v.label}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}