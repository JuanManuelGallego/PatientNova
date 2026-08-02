import {
  ReminderMode,
  Channel,
} from "@/src/types/Reminder";
import { Patient } from "@/src/types/Patient";

export interface StepChannelProps {
  channel: Channel | undefined;
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

export interface StepTemplateProps {
  selectedTemplate: string;
  onTemplateChange: (key: string) => void;
  sharedVariables: Record<string, string>;
  onSharedVariablesChange: (vars: Record<string, string>) => void;
  recipientCount: number;
  sendMode: ReminderMode;
  sending: boolean;
  onBack: () => void;
  onSend: () => void;
}
