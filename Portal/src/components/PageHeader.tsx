import React from "react";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    style?: React.CSSProperties;
}

export function PageHeader({ title, subtitle, actions, style }: PageHeaderProps) {
    return (
        <div className="page-header" style={style}>
            <div>
                <h1 className="page-title">{title}</h1>
                {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="page-header__actions">{actions}</div>}
        </div>
    );
}
