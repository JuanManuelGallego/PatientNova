import { useId, type ReactNode } from "react";

interface SettingsSectionProps {
    title: string;
    /** One line; links to the place that owns a related setting. */
    description?: ReactNode;
    /** Save feedback, e.g. `SaveStatusIndicator`. */
    status?: ReactNode;
    /** Header buttons, e.g. "Nuevo". */
    actions?: ReactNode;
    id?: string;
    testId?: string;
    children: ReactNode;
}

/** The frame every Settings section uses: titled card, optional status and actions in the header. */
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
