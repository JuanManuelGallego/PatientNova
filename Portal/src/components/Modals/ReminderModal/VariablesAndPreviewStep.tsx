import { ReminderForm } from "@/src/types/Reminder";
import { TwilioTemplate } from "@/src/utils/twilioConfig";
import { RequiredField } from "@/src/components/Info/Required";

export function VariablesAndPreviewStep({
  form,
  setForm,
  selectedTemplate,
  preview,
}: {
  form: ReminderForm;
  setForm: React.Dispatch<React.SetStateAction<ReminderForm>>;
  selectedTemplate: TwilioTemplate;
  preview: string;
}) {
  const userEditableVariables = selectedTemplate.variables.filter(
    (v) => v.autoFill !== "userId",
  );

  return (
    <div className="form-stack">
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