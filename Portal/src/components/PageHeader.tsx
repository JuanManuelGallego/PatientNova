import React from "react";
import { browserTimezone, fmtTimezoneLabel, getDisplayTimezone } from "@/src/utils/TimeUtils";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    style?: React.CSSProperties;
}

export function PageHeader({ title, subtitle, actions, style }: PageHeaderProps) {
    // Times are shown in the provider's timezone; say so when the device is elsewhere.
    const zoneNote = getDisplayTimezone() !== browserTimezone() ? `Hora de ${fmtTimezoneLabel()}` : null;
    return (
        <div className="page-header" style={style}>
            <div>
                <h1 className="page-title">{title}</h1>
                {(subtitle || zoneNote) && (
                    <p className="page-subtitle">
                        {[ subtitle, zoneNote ].filter(Boolean).join(" · ")}
                    </p>
                )}
            </div>
            {actions && <div className="page-header__actions">{actions}</div>}
        </div>
    );
}
