"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBulkSend } from "@/src/api/notify/useBulkSend";
import { Patient, getPatientContact } from "@/src/types/Patient";
import { ReminderMode } from "@/src/types/Reminder";
import { TWILIO_CONFIG } from "@/src/utils/twilioConfig";
import { STATUS_ICONS } from "@/src/config/icons";
import { WizardStepper } from "./WizardStepper";
import { StepChannel } from "./StepChannel";
import { StepPatients } from "./StepPatients";
import { StepTemplate } from "./StepTemplate";

export function BulkSendWizard({ patients }: { patients: Patient[] }) {
  const { bulkSend } = useBulkSend();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [sendMode, setMode] = useState<ReminderMode>(ReminderMode.IMMEDIATE);
  const [sendAt, setSendAt] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [sharedVariables, setSharedVariables] = useState<Record<string, string>>({});

  // Each patient is messaged on their own reminder channel.
  const eligible = useMemo(
    () => patients.filter((p) => p.status === "ACTIVE" && !!getPatientContact(p)),
    [patients],
  );

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === eligible.length) return new Set();
      return new Set(eligible.map((p) => p.id));
    });
  }, [eligible]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSend = useCallback(async () => {
    if (!selectedTemplate) return;
    setSending(true);
    setError(null);
    try {
      // Patients on SMS/EMAIL have no WhatsApp content template: always send the
      // raw message text and let the server render {{N}} placeholders per patient.
      const body = TWILIO_CONFIG[selectedTemplate]?.template ?? "";
      await bulkSend({
        templateKey: selectedTemplate,
        patientIds: Array.from(selected),
        sendMode,
        ...(sendMode === ReminderMode.SCHEDULED && sendAt ? { sendAt } : {}),
        sharedVariables,
        body,
      });
      router.push("/reminders");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar");
      setSending(false);
    }
  }, [
    selectedTemplate,
    selected,
    sendMode,
    sendAt,
    sharedVariables,
    bulkSend,
    router,
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} data-testid="bulk-send-wizard">
      <WizardStepper step={step} />
      {error && (
        <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <STATUS_ICONS.warning size={14} /> {error}
        </div>
      )}
      {step === 1 && (
        <StepChannel
          sendMode={sendMode}
          setMode={setMode}
          sentAt={sendAt}
          setSentAt={setSendAt}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <StepPatients
          eligible={eligible}
          selected={selected}
          toggleAll={toggleAll}
          toggleOne={toggleOne}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <StepTemplate
          selectedTemplate={selectedTemplate}
          onTemplateChange={setSelectedTemplate}
          sharedVariables={sharedVariables}
          onSharedVariablesChange={setSharedVariables}
          recipientCount={selected.size}
          sendMode={sendMode}
          sending={sending}
          onBack={() => setStep(2)}
          onSend={handleSend}
        />
      )}
    </div>
  );
}
