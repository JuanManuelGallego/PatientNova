import { ReminderMode, BulkRemindersResult, Channel } from "@/src/types/Reminder";
import { Patient } from "@/src/types/Patient";

export interface StepChannelProps {
    patients: Patient[];
    channel: Channel;
    setChannel: (c: Channel) => void;
    setSelected: (s: Set<string>) => void;
    sendMode: ReminderMode;
    setMode: (m: ReminderMode) => void;
    sentAt: string;
    setSentAt: (s: string) => void;
    onNext: () => void;
}

export interface StepPatientsProps {
    eligible: Patient[];
    channel: Channel;
    selected: Set<string>;
    toggleAll: () => void;
    toggleOne: (id: string) => void;
    onBack: () => void;
    onNext: () => void;
}

export interface StepMessageProps {
    message: string;
    setMessage: (m: string) => void;
    recipientCount: number;
    sendMode: ReminderMode;
    sending: boolean;
    onBack: () => void;
    onSend: () => void;
}

export interface StepResultsProps {
    results: BulkRemindersResult[];
    onReset: () => void;
}
