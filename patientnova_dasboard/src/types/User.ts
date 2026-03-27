export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string
    avatarUrl: string
    jobTitle: string
    role: AdminRole
    status: AdminStatus
}

export enum AdminRole {
    VIEWER = 'VIEWER',
    ADMIN = 'ADMIN',
    SUPER_ADMIN = 'SUPER_ADMIN'
}

export enum AdminStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    SUSPENDED = 'SUSPENDED',
    PENDING = 'PENDING'
}
