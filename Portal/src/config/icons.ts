/**
 * ─── Centralized Icon Map ────────────────────────────────────────────────────
 *
 * All Lucide icons used throughout the application are re-exported from here.
 * To change any icon, update the import and re-export in this file — one line.
 *
 * Usage in components:
 *   import { NAV_ICONS, ACTION_ICONS } from "@/src/config/icons";
 *   <NAV_ICONS.dashboard className="size-5" />
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  LayoutDashboard,
  Users,
  ClipboardList,
  CalendarCheck,
  CalendarDays,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  CheckCircle,
  Ban,
  XCircle,
  ExternalLink,
  MapPin,
  Calendar,
  Clock,
  Timer,
  DollarSign,
  CreditCard,
  StickyNote,
  Fingerprint,
  RefreshCw,
  Archive,
  Mail,
  MessageCircle,
  Smartphone,
  Phone,
  Megaphone,
  FileText,
  Image,
  FileSpreadsheet,
  Paperclip,
  File,
  Send,
  Link2,
  Flag,
  CircleDot,
  Loader2,
  type LucideIcon,
} from "lucide-react";

/* ── Sidebar Navigation ─────────────────────────────────────────────────── */
export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  patients: Users,
  "medical-records": ClipboardList,
  appointments: CalendarCheck,
  calendar: CalendarDays,
  reminders: Bell,
  settings: Settings,
} as const satisfies Record<string, LucideIcon>;

/* ── Action Buttons ──────────────────────────────────────────────────────── */
export const ACTION_ICONS = {
  edit: Pencil,
  delete: Trash2,
  close: X,
  plus: Plus,
  search: Search,
  menu: Menu,
  logout: LogOut,
  confirm: Check,
  cancel: Ban,
  retry: RefreshCw,
  send: Send,
  link: ExternalLink,
  loader: Loader2,
} as const satisfies Record<string, LucideIcon>;

/* ── Status Icons (for ConfirmDialog, EmptyState, etc.) ──────────────────── */
export const STATUS_ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  danger: XCircle,
  info: CircleDot,
  search: Search,
  calendar: Calendar,
  bell: Bell,
  clipboard: ClipboardList,
  flag: Flag,
  ban: Ban,
  trash: Trash2,
  mapPin: MapPin,
  megaphone: Megaphone,
  archive: Archive,
} as const satisfies Record<string, LucideIcon>;

/* ── Channel Icons (WhatsApp, SMS) ───────────────────────────────────────── */
export const CHANNEL_ICONS = {
  WHATSAPP: MessageCircle,
  SMS: Smartphone,
} as const satisfies Record<string, LucideIcon>;

/* ── Detail Row Icons (Drawers) ──────────────────────────────────────────── */
export const DETAIL_ICONS = {
  mail: Mail,
  whatsapp: MessageCircle,
  sms: Smartphone,
  phone: Phone,
  calendar: Calendar,
  clock: Clock,
  timer: Timer,
  mapPin: MapPin,
  link: ExternalLink,
  dollar: DollarSign,
  creditCard: CreditCard,
  note: StickyNote,
  id: Fingerprint,
  refresh: RefreshCw,
  archive: Archive,
  send: Send,
  megaphone: Megaphone,
  flag: Flag,
} as const satisfies Record<string, LucideIcon>;

/* ── File / Document MIME Icons ──────────────────────────────────────────── */
export const FILE_ICONS: Record<string, LucideIcon> = {
  "application/pdf": FileText,
  "application/msword": FileText,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    FileText,
  "application/vnd.ms-excel": FileSpreadsheet,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    FileSpreadsheet,
  "image/png": Image,
  "image/jpeg": Image,
  "image/webp": Image,
};

export const FILE_ICON_DEFAULT: LucideIcon = Paperclip;

/* ── Dropdown / Select Icons ─────────────────────────────────────────────── */
export const SELECT_ICONS = {
  chevronDown: ChevronDown,
  check: Check,
} as const;

/* ── Pagination Icons ────────────────────────────────────────────────────── */
export const PAGINATION_ICONS = {
  prev: ChevronLeft,
  next: ChevronRight,
} as const;

/* Re-export LucideIcon type for component props */
export type { LucideIcon };
