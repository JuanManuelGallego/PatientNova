import { BlockedTime } from "@/src/types/BlockedTime";

export enum ViewMode {
  Month = "month",
  Week = "week",
  /** Phones only: the agenda (week strip and the selected day's list). Wider screens read it as Week. */
  Day = "day",
}

/** The views the desktop toolbar offers, in order. */
export const DESKTOP_VIEWS = [ ViewMode.Month, ViewMode.Week ] as const;

export interface ApptChipProps {
  a: import("@/src/types/Appointment").Appointment;
  compact?: boolean;
  onViewAppt: (a: import("@/src/types/Appointment").Appointment) => void;
  style?: React.CSSProperties;
}

export interface BlockedTimeChipProps {
  bt: BlockedTime;
  onSelectBlockedTime: (bt: BlockedTime) => void;
  style?: React.CSSProperties;
}

export interface BlockedTimeBlockProps {
  bt: BlockedTime;
  onSelectBlockedTime: (bt: BlockedTime) => void;
  style?: React.CSSProperties;
}

export interface CalendarToolbarProps {
  navLabel: string;
  viewMode: ViewMode;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onChangeView: (v: ViewMode) => void;
}

type HeldSlot = import("./constants").HeldSlot;

/** Optional on every view: only admins with the portal on see pending holds. */
interface HoldProps {
  holdByDate?: Record<string, HeldSlot[]>;
  onSelectHold?: (id: string) => void;
}

export interface MonthViewProps extends HoldProps {
  timezone: string;
  rows: number;
  cellDate: (cell: number) => string | null;
  apptByDate: Record<string, import("@/src/types/Appointment").Appointment[]>;
  blockedByDate: Record<string, BlockedTime[]>;
  holidayMap: Record<string, string>;
  loading: boolean;
  onSelectDay: (date: string) => void;
  onDrillToDay: (date: string) => void;
  onViewAppt: (a: import("@/src/types/Appointment").Appointment) => void;
  onSelectBlockedTime: (bt: BlockedTime) => void;
}

export interface WeekViewProps extends HoldProps {
  timezone: string;
  weekDays: Date[];
  apptByDate: Record<string, import("@/src/types/Appointment").Appointment[]>;
  blockedByDate: Record<string, BlockedTime[]>;
  holidayMap: Record<string, string>;
  loading: boolean;
  hourRange: import("./constants").HourRange;
  onDrillToDay: (date: string) => void;
  onViewAppt: (a: import("@/src/types/Appointment").Appointment) => void;
  onCreateAt: (date: string) => void;
  onSelectBlockedTime: (bt: BlockedTime) => void;
}

export interface DayViewProps {
  timezone: string;
  dayDate: string;
  apptByDate: Record<string, import("@/src/types/Appointment").Appointment[]>;
  blockedByDate: Record<string, BlockedTime[]>;
  holidayMap: Record<string, string>;
  loading: boolean;
  hourRange: import("./constants").HourRange;
  onViewAppt: (a: import("@/src/types/Appointment").Appointment) => void;
  onCreateAt: (date: string) => void;
  onSelectBlockedTime: (bt: BlockedTime) => void;
}

export interface DayPanelProps {
  selectedDay: string;
  holds?: HeldSlot[];
  onSelectHold?: (id: string) => void;
  appts: import("@/src/types/Appointment").Appointment[];
  blockedTimes: BlockedTime[];
  onClose: () => void;
  onViewAppt: (a: import("@/src/types/Appointment").Appointment) => void;
  onDrillToDay: (date: string) => void;
  /** "Nueva cita" for the panel's calendar day; the page picks the time (an instant, never a bare date). */
  onCreateOnDay: (day: string) => void;
  onSelectBlockedTime: (bt: BlockedTime) => void;
  onCreateBlockedTime: (date: string) => void;
}
