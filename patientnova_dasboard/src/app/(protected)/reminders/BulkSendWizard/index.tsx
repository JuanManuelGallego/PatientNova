"use client";

import { useState, useMemo, useCallback } from "react";
import { useCreateReminder } from "@/src/api/useCreateReminder";
import { useNotify } from "@/src/api/useNotify";
import { Patient } from "@/src/types/Patient";
import { ReminderMode, Channel } from "@/src/types/Reminder";
import { getUserName } from "@/src/utils/AvatarHelper";
import { useAuthContext } from "@/src/app/AuthContext";
import { TWILIO_CONFIG } from "@/src/utils/twilioConfig";
import { ERR_PATIENT_NOT_FOUND } from "@/src/constants/ui";
import { BulkRemindersResult } from "@/src/types/Reminder";
import { WizardStepper } from "./WizardStepper";
import { StepChannel } from "./StepChannel";
import { StepPatients } from "./StepPatients";
import { StepMessage } from "./StepMessage";
import { StepResults } from "./StepResults";

export function BulkSendWizard({ patients }: { patients: Patient[] }) {
    const { notify } = useNotify();
    const { createReminder } = useCreateReminder();
    const { user } = useAuthContext();
    const [ step, setStep ] = useState(1);
    const [ channel, setChannel ] = useState<Channel>(Channel.WHATSAPP);
    const [ message, setMessage ] = useState("");
    const [ sendMode, setMode ] = useState<ReminderMode>(ReminderMode.IMMEDIATE);
    const [ sendAt, setSendAt ] = useState("");
    const [ selected, setSelected ] = useState<Set<string>>(new Set());
    const [ sending, setSending ] = useState(false);
    const [ results, setResults ] = useState<BulkRemindersResult[]>([]);
    const [ done, setDone ] = useState(false);

    const eligible = useMemo(() => patients.filter(p =>
        p.status === "ACTIVE" &&
        (channel === Channel.WHATSAPP ? !!p.whatsappNumber : channel === Channel.SMS ? !!p.smsNumber : !!p.email)
    ), [ patients, channel ]);

    const toggleAll = useCallback(() => {
        setSelected(prev => {
            if (prev.size === eligible.length) return new Set();
            return new Set(eligible.map(p => p.id));
        });
    }, [ eligible ]);

    const toggleOne = useCallback((id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const handleSend = useCallback(async () => {
        setSending(true);
        const patientMap = new Map(eligible.map(p => [ p.id, p ]));
        const tasks = Array.from(selected).map(async (pid): Promise<BulkRemindersResult> => {
            const p = patientMap.get(pid);
            if (!p) return { patientId: pid, name: pid, channel, status: "skipped", reason: ERR_PATIENT_NOT_FOUND };

            const fullName = `${p.name} ${p.lastName}`;
            const to = channel === Channel.WHATSAPP ? p.whatsappNumber : channel === Channel.SMS ? p.smsNumber : p.email;
            if (!to) return { patientId: pid, name: fullName, channel, status: "skipped", reason: "Sin número" };

            try {
                if (sendMode === ReminderMode.IMMEDIATE) {
                    await notify(channel, {
                        to,
                        patientId: pid,
                        contentSid: TWILIO_CONFIG.PATIENT_APPOINTMENT_REMINDER.contentSid,
                        contentVariables: {
                            "1": p.name,
                            "2": getUserName(user) || "su profesional de salud",
                            "3": "12 de Abril",
                            "4": "3:00 PM",
                        },
                        body: message || TWILIO_CONFIG.PATIENT_APPOINTMENT_REMINDER.template
                            .replace("{{1}}", p.name)
                            .replace("{{2}}", getUserName(user) || "su profesional de salud"),
                    });
                } else {
                    await createReminder({
                        patientId: pid,
                        contentSid: TWILIO_CONFIG.PATIENT_APPOINTMENT_REMINDER.contentSid,
                        contentVariables: {
                            "1": p.name,
                            "2": getUserName(user) || "su profesional de salud",
                            "3": "12 de Abril",
                            "4": "3:00 PM",
                        },
                        sendMode,
                        channel,
                        to,
                        sendAt,
                        body: message || TWILIO_CONFIG.PATIENT_APPOINTMENT_REMINDER.template
                            .replace("{{1}}", p.name)
                            .replace("{{2}}", getUserName(user) || "su profesional de salud"),
                    });
                }
                return { patientId: pid, name: fullName, channel, status: "ok", reason: "" };
            } catch (e) {
                return { patientId: pid, name: fullName, channel, status: "error", reason: String(e) };
            }
        });
        const res = await Promise.all(tasks);
        setResults(res); setSending(false); setDone(true); setStep(4);
    }, [ eligible, selected, channel, sendMode, notify, message, user, createReminder, sendAt ]);

    const reset = useCallback(() => {
        setStep(1); setSelected(new Set()); setMessage(""); setResults([]); setDone(false);
    }, []);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <WizardStepper step={step} />
            {step === 1 && (
                <StepChannel
                    patients={patients}
                    channel={channel}
                    setChannel={setChannel}
                    setSelected={setSelected}
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
                    channel={channel}
                    selected={selected}
                    toggleAll={toggleAll}
                    toggleOne={toggleOne}
                    onBack={() => setStep(1)}
                    onNext={() => setStep(3)}
                />
            )}
            {step === 3 && (
                <StepMessage
                    message={message}
                    setMessage={setMessage}
                    recipientCount={selected.size}
                    sendMode={sendMode}
                    sending={sending}
                    onBack={() => setStep(2)}
                    onSend={handleSend}
                />
            )}
            {step === 4 && done && (
                <StepResults results={results} onReset={reset} />
            )}
        </div>
    );
}
