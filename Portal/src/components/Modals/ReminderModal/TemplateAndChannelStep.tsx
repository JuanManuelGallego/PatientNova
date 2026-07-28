import { Patient } from "@/src/types/Patient";
import { ReminderForm, Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import {
  getAvatarColor,
  getInitials,
} from "@/src/utils/AvatarHelper";
import { CHANNEL_ICONS, ACTION_ICONS } from "@/src/config/icons";
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
    (channel === Channel.SMS && !!selectedPatient?.smsNumber);

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
          className={`selection-card selection-card--active${!available ? " selection-card--disabled" : ""}`}
          style={{ flex: 1 }}
        >
          <span style={{ fontSize: 22 }}>
            {(() => {
              const Icon = CHANNEL_ICONS[ channel ];
              return Icon ? <Icon size={22} /> : null;
            })()}
          </span>
          <div>
            <div className="patient-preview__name">
              {CHANNEL_CFG[ channel ].label}
            </div>
            <div className="patient-preview__detail">
              {available
                ? channel === Channel.WHATSAPP
                  ? selectedPatient?.whatsappNumber
                  : selectedPatient?.smsNumber
                : "No disponible para este paciente."}
            </div>
          </div>
          {available && (
            <span style={{ marginLeft: "auto", color: "var(--c-brand)" }}>
              <ACTION_ICONS.confirm size={16} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
