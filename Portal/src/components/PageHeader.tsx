import React from "react";
import { browserTimezone, fmtTimezoneLabel } from "@/src/utils/TimeUtils";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    style?: React.CSSProperties;
}

export function PageHeader({ title, subtitle, actions, style }: PageHeaderProps) {
  const timezone = useDisplayTimezone();
    // Times are shown in the provider's timezone; say so when the device is elsewhere.
    const zoneNote = timezone !== browserTimezone() ? `Hora de ${fmtTimezoneLabel(timezone)}` : null;
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
