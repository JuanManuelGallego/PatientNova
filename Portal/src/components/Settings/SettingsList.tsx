import type { ReactNode } from "react";
import type { LucideIcon } from "@/src/config/icons";
import { EmptyState } from "@/src/components/EmptyState";
import { InlineError } from "@/src/components/Info/InlineError";
import { useDelayedLoading } from "@/src/hooks/useDelayedLoading";
import { SettingsSection } from "./SettingsSection";

interface SettingsListProps<T extends { id: string }> {
    title: string;
    description: string;
    newLabel: string;
    newTestId: string;
    onNew: () => void;
    /** Undefined until the first load finishes. */
    items: T[] | undefined;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
    empty: { icon: LucideIcon; title: string; sub: string };
    renderItem: (item: T) => ReactNode;
    status?: ReactNode;
    testId?: string;
}

/** A Settings CRUD list: "Nuevo" in the header, then the items, the load error, a skeleton or the empty state. */
export function SettingsList<T extends { id: string }>({
    title, description, newLabel, newTestId, onNew, items, loading, error, onRetry, empty, renderItem, status, testId,
}: SettingsListProps<T>) {
    const showSkeleton = useDelayedLoading(loading);

    let body: ReactNode = null;
    if (items && items.length > 0) {
        body = <div className="settings-list">{items.map(renderItem)}</div>;
    } else if (items) {
        body = <EmptyState icon={empty.icon} title={empty.title} sub={empty.sub} />;
    } else if (error) {
        body = (
            <div className="form-stack">
                <InlineError message={error} />
                <div>
                    <button type="button" className="btn-secondary" onClick={onRetry}>Reintentar</button>
                </div>
            </div>
        );
    } else if (showSkeleton) {
        body = (
            <div className="settings-list" aria-busy="true" data-testid="settings-list-skeleton">
                {[ 0, 1, 2 ].map((i) => (
                    <div key={i} className="settings-list__skeleton">
                        <div className="skeleton-bar" style={{ width: "40%" }} />
                        <div className="skeleton-bar" style={{ width: "65%" }} />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <SettingsSection
            title={title}
            description={description}
            status={status}
            actions={<button type="button" className="btn-primary" onClick={onNew} data-testid={newTestId}>{newLabel}</button>}
            testId={testId}
        >
            {body}
        </SettingsSection>
    );
}
