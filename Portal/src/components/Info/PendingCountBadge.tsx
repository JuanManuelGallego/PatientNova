/** Screen-reader text for a pending count, read after the entry's name. */
export const pendingCountText = (count: number) => `, ${count} pendientes`;

/**
 * The pending booking-request count on a navigation entry (sidebar and tab bar), capped at 99+.
 * `announce={false}` hides it from screen readers when the entry reads `pendingCountText` itself, after its
 * label (the tab bar draws the badge on the icon, before the label).
 */
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
