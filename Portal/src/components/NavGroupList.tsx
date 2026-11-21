import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "@/src/config/icons";
import { isNavItemActive, type NavGroup, type NavItem } from "@/src/config/navigation";

interface NavGroupListProps<Id extends string> {
    groups: NavGroup<Id>[];
    pathname: string;
    onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
    /** Links replace the current history entry instead of pushing one. */
    replace?: boolean;
    testIdPrefix: string;
    ariaLabel: string;
    className?: string;
    testId?: string;
    icon?: (id: Id) => LucideIcon | undefined;
    badge?: (item: NavItem<Id>) => ReactNode;
}

export function NavGroupList<Id extends string>({
    groups, pathname, onNavigate, replace = false, testIdPrefix, ariaLabel, className, testId, icon, badge,
}: NavGroupListProps<Id>) {
    return (
        <nav className={className} aria-label={ariaLabel} data-testid={testId}>
            {groups.map((group) => {
                const labelId = group.label ? `${testIdPrefix}-group-${group.id}` : undefined;
                return (
                    <div key={group.id} className="sidebar-group" role="group" aria-labelledby={labelId}>
                        {group.label && <div id={labelId} className="sidebar-group-label">{group.label}</div>}
                        {group.items.map((item) => {
                            const isActive = isNavItemActive(pathname, item.path);
                            const Icon = icon?.(item.id);
                            return (
                                <Link
                                    key={item.id}
                                    href={item.href ?? item.path}
                                    onClick={onNavigate}
                                    replace={replace}
                                    aria-current={isActive ? "page" : undefined}
                                    data-testid={`${testIdPrefix}-${item.id}`}
                                >
                                    <div className={`nav-item ${isActive ? "active" : ""}`}>
                                        {Icon && <Icon size={18} />}
                                        {item.label}
                                        {badge?.(item)}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                );
            })}
        </nav>
    );
}
