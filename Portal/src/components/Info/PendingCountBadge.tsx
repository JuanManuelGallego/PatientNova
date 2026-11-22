export const pendingCountText = (count: number) => `, ${count} pendientes`;

export function PendingCountBadge({ count, testId, className = "", announce = true }: {
    count: number; testId: string; className?: string; announce?: boolean;
}) {
    if (count <= 0) return null;
    return (
        <span className={`nav-badge ${className}`.trim()} data-testid={testId} aria-hidden={announce ? undefined : true}>
            <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
            {announce && <span className="sr-only">{pendingCountText(count)}</span>}
        </span>
    );
}
