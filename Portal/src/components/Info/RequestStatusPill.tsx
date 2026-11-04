import { STATUS_ICONS, type LucideIcon } from "@/src/config/icons";
import { REQUEST_STATUS_LABELS, type BookingRequestStatus } from "@/src/types/BookingRequest";

const ICON: Record<BookingRequestStatus, { Icon: LucideIcon; color: string }> = {
  PENDING: { Icon: STATUS_ICONS.pending, color: "var(--c-warning-dark)" },
  APPROVED: { Icon: STATUS_ICONS.success, color: "var(--c-success)" },
  REJECTED: { Icon: STATUS_ICONS.danger, color: "var(--c-error)" },
  EXPIRED: { Icon: STATUS_ICONS.expired, color: "var(--c-gray-500)" },
  CANCELLED: { Icon: STATUS_ICONS.cancelled, color: "var(--c-gray-500)" },
};

export function RequestStatusPill({ status }: { status: BookingRequestStatus }) {
  const { Icon, color } = ICON[ status ];
  return (
    <span className="pill status-icon-pill" data-testid={`request-status-${status.toLowerCase()}`}>
      <Icon size={15} style={{ color }} aria-hidden="true" />
      {REQUEST_STATUS_LABELS[ status ]}
    </span>
  );
}
