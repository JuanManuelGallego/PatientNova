import { Patient, getPatientContact } from "@/src/types/Patient";
import { ReminderForm, Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import {
  getAvatarColor,
  getInitials,
} from "@/src/utils/AvatarHelper";
import { CHANNEL_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { CustomSelect } from "@/src/components/CustomSelect";
import { RequiredField } from "@/src/components/Info/Required";
import {
  TWILIO_CONFIG,
  TEMPLATE_KEYS,
} from "@/src/utils/twilioConfig";

export function TemplateAndChannelStep({
  form,
  selectedPatient,
  channel,
  onTemplateChange,
}: {
  form: ReminderForm;
  selectedPatient: Patient | undefined;
  channel: Channel;
  onTemplateChange: (key: string) => void;
}) {
  const available =
    (channel === Channel.WHATSAPP && !!selectedPatient?.whatsappNumber) ||
    (channel === Channel.SMS && !!selectedPatient?.smsNumber) ||
    (channel === Channel.EMAIL && !!selectedPatient?.email);

  const contact = selectedPatient
    ? getPatientContact(selectedPatient, channel)
    : undefined;

  return (
    <div className="form-stack">
      {selectedPatient && (
        <div className="patient-preview">
          <div
            className="avatar avatar--md"
            style={{ background: getAvatarColor(selectedPatient.id) }}
          >
            {getInitials(selectedPatient.name, selectedPatient.lastName)}
          </div>
          <div>
            <div className="patient-preview__name">
              {selectedPatient.name} {selectedPatient.lastName}
            </div>
            <div className="patient-preview__detail">
              {selectedPatient.email}
            </div>
          </div>
        </div>
      )}
      <label className="form-label">
        <RequiredField label="Plantilla" />
        <CustomSelect
          value={form.selectedTemplate}
          placeholder="Seleccionar plantilla…"
          options={TEMPLATE_KEYS.map((key) => ({
            value: key,
            label: TWILIO_CONFIG[key].label,
          }))}
          onChange={onTemplateChange}
        />
      </label>
      <div>
        <div className="channel-section-label">
          <RequiredField label="Canal de notificación" />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--c-brand-50, #f0f7ff)",
            border: "1px solid var(--c-brand-200, #bfdbfe)",
            fontSize: 14,
            color: "var(--c-brand)",
          }}
        >
          {(() => {
            const Icon = CHANNEL_ICONS[ channel ];
            return Icon ? <Icon size={18} /> : null;
          })()}
          <span>
            Enviando por <strong>{CHANNEL_CFG[ channel ].label}</strong>
            {contact && (
              <span
                style={{
                  marginLeft: 6,
                  color: "var(--c-gray-400)",
                  fontWeight: 400,
                }}
              >
                → {contact}
              </span>
            )}
          </span>
        </div>
        {selectedPatient && !available && (
          <div
            className="error-inline"
            style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}
          >
            <STATUS_ICONS.warning size={14} /> El paciente no tiene{" "}
            {channel === Channel.WHATSAPP
              ? "número de WhatsApp"
              : channel === Channel.SMS
                ? "número de SMS"
                : "correo electrónico"}{" "}
            registrado. Agrega el dato o cambia el canal de recordatorios del
            paciente.
          </div>
        )}
      </div>
    </div>
  );
}
