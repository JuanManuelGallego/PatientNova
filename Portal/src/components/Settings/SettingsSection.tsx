import { useId, type ReactNode } from "react";

interface SettingsSectionProps {
    title: string;
    description?: ReactNode;
    status?: ReactNode;
    actions?: ReactNode;
    id?: string;
    testId?: string;
    children: ReactNode;
}

export function SettingsSection({ title, description, status, actions, id, testId, children }: SettingsSectionProps) {
    const headingId = useId();
    return (
        <section className="dash-card settings-section" aria-labelledby={headingId} id={id} data-testid={testId}>
            <div className="dash-card__header settings-section__header">
                <div className="settings-section__heading">
                    <h2 className="dash-card__title" id={headingId}>{title}</h2>
                    {description && <p className="settings-section__description">{description}</p>}
                </div>
                {(status || actions) && (
                    <div className="settings-section__aside">
                        {status}
                        {actions}
                    </div>
                )}
            </div>
            <div className="dash-card__body">{children}</div>
        </section>
    );
}
