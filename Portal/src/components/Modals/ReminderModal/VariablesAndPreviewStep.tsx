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
  sentByServer = false,
}: {
  form: ReminderForm;
  setForm: React.Dispatch<React.SetStateAction<ReminderForm>>;
  selectedTemplate: TwilioTemplate;
  preview: string;
  missingConsentType?: string | null;
  /** The server fills the variables from the patient and the provider's profile: shown, not editable. */
  sentByServer?: boolean;
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
          {sentByServer && (
            <p className="form-input-hint" style={{ marginBottom: 8 }} data-testid="reminder-welcome-hint">
              Se completan con los datos del paciente y de tu perfil. Para cambiarlos, edítalos en Configuración.
            </p>
          )}
          <div className="form-grid-2">
            {userEditableVariables.map((v) => (
              <label key={v.key} className="form-label">
                {v.label}
                <input
                  className="form-input"
                  type="text"
                  value={form.contentVariables[v.key] || ""}
                  disabled={sentByServer}
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