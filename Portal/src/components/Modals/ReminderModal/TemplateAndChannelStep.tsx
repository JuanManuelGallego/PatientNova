import { Patient, getPatientContact } from "@/src/types/Patient";
import { ReminderForm, Channel } from "@/src/types/Reminder";
import {
  getAvatarColor,
  getInitials,
} from "@/src/utils/AvatarHelper";
import { CustomSelect } from "@/src/components/CustomSelect";
import { RequiredField } from "@/src/components/Info/Required";
import { ChannelBanner } from "@/src/components/Info/ChannelBanner";
import { TWILIO_CONFIG } from "@/src/utils/twilioConfig";

export function TemplateAndChannelStep({
  form,
  selectedPatient,
  channel,
  templateKeys,
  onTemplateChange,
}: {
  form: ReminderForm;
  selectedPatient: Patient | undefined;
  channel: Channel;
  templateKeys: string[];
  onTemplateChange: (key: string) => void;
}) {
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
          options={templateKeys.map((key) => ({
            value: key,
            label: TWILIO_CONFIG[key].label,
          }))}
          onChange={onTemplateChange}
        />
      </label>
      <ChannelBanner
        channel={channel}
        contact={contact}
        required
        marginTop={0}
        warnMissingContact={!!selectedPatient}
      />
    </div>
  );
}
