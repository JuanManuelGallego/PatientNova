export enum ViewMode {
  Month = "month",
  Week = "week",
  Day = "day",
}

export interface ApptChipProps {
  a: import("@/src/types/Appointment").Appointment;
  compact?: boolean;
  onViewAppt: (a: import("@/src/types/Appointment").Appointment) => void;
}

export interface CalendarToolbarProps {
  navLabel: string;
  viewMode: ViewMode;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onChangeView: (v: ViewMode) => void;
}

export interface MonthViewProps {
  rows: number;
  cellDate: (cell: number) => string | null;
  apptByDate: Record<string, import("@/src/types/Appointment").Appointment[]>;
  holidayMap: Record<string, string>;
  loading: boolean;
  onSelectDay: (date: string) => void;
  onDrillToDay: (date: string) => void;
  onViewAppt: (a: import("@/src/types/Appointment").Appointment) => void;
}

export interface WeekViewProps {
  weekDays: Date[];
  apptByDate: Record<string, import("@/src/types/Appointment").Appointment[]>;
  holidayMap: Record<string, string>;
  loading: boolean;
  onDrillToDay: (date: string) => void;
  onViewAppt: (a: import("@/src/types/Appointment").Appointment) => void;
  onCreateAt: (date: string) => void;
}

export interface DayViewProps {
  dayDate: string;
  apptByDate: Record<string, import("@/src/types/Appointment").Appointment[]>;
  holidayMap: Record<string, string>;
  loading: boolean;
  onViewAppt: (a: import("@/src/types/Appointment").Appointment) => void;
  onCreateAt: (date: string) => void;
}

export interface DayPanelProps {
  selectedDay: string;
  appts: import("@/src/types/Appointment").Appointment[];
  onClose: () => void;
  onViewAppt: (a: import("@/src/types/Appointment").Appointment) => void;
  onDrillToDay: (date: string) => void;
  onCreateAt: (date: string) => void;
}
