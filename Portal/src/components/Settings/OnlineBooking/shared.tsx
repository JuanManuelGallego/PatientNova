"use client";

import { ReactNode } from "react";
import { BookingSettings, BookingSettingsUpdate } from "@/src/types/Booking";
import { STATUS_ICONS } from "@/src/config/icons";

export const LINK_SECTION_ID = "online-booking-link";
export const PROFILE_SECTION_ID = "online-booking-profile";
export const AVAILABILITY_SECTION_ID = "online-booking-availability";

export type SaveFn = (body: BookingSettingsUpdate) => Promise<BookingSettings>;

export function WarningHint({ testId, children }: { testId: string; children: ReactNode }) {
    return (
        <div className="form-input-hint" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-warning-dark)" }} data-testid={testId}>
            <STATUS_ICONS.warning size={14} />
            {children}
        </div>
    );
}
